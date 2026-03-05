# Ollama Web Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace embedding-based AI search with a CrossRef-first, Ollama-summarize flow: fetch real papers from CrossRef, pass them as context to Ollama, stream the response into a modal, and let users import any result with one click.

**Architecture:** `OllamaWebSearch` in `app.go` fetches CrossRef papers, builds a prompt, streams Ollama's response token-by-token via Wails `runtime.EventsEmit`, then emits the paper list. A new `OllamaSearchModal` in the frontend listens to those events and renders streaming text above import cards.

**Tech Stack:** Go `net/http` (CrossRef search, Ollama streaming), Wails v2 event system, React + Tailwind + shadcn/ui.

---

### Task 1: Remove Embedding Code

**Files:**
- Delete: `app/database/embedding_repository.go`
- Delete: `app/ollama/search.go`
- Delete: `app/ollama/search_test.go`
- Modify: `app/database/sqlite.go`
- Modify: `app.go`
- Modify: `frontend/src/hooks/useReferences.ts`

**Step 1: Delete the three files**

```bash
rm app/database/embedding_repository.go app/ollama/search.go app/ollama/search_test.go
```

**Step 2: Remove the ref_embeddings migration from sqlite.go**

In `app/database/sqlite.go`, remove this entry from the `required` slice:

```go
`CREATE TABLE IF NOT EXISTS ref_embeddings (
    ref_id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    embedding TEXT NOT NULL,
    embedded_at DATETIME NOT NULL,
    FOREIGN KEY (ref_id) REFERENCES refs(id) ON DELETE CASCADE
)`,
```

**Step 3: Clean up app.go**

Remove:
- The `"sort"` import
- The `scoredRef` struct
- The `OllamaSearchReferences` method (entire function)
- The `InvalidateEmbedding` method (entire function)
- The embedding invalidation lines from `UpdateReference`:

```go
	// Invalidate cached embedding — the content may have changed.
	_ = a.repo.DeleteEmbedding(input.ID)
```

Also update `UpdateReference` to restore its original simple form:

```go
func (a *App) UpdateReference(input models.UpdateReferenceInput) (*models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.service.Update(input)
}
```

**Step 4: Clean up useReferences.ts**

In `frontend/src/hooks/useReferences.ts`:

Remove from the `App` interface in `declare global`:
```typescript
          OllamaSearchReferences: (query: string, model: string, baseURL: string) => Promise<any[]>;
          InvalidateEmbedding: (refID: string) => Promise<void>;
```

Remove the `ollamaSearchReferences` function body and its entry in the return object.

Remove the `OllamaSettings` import from the function signature (keep the type import in the file — it's still used by the store).

**Step 5: Verify it compiles**

```bash
go build ./app/... && go test ./app/ollama/... -v
cd frontend && npm run build 2>&1 | tail -5
```
Expected: no errors. The only ollama tests remaining are the 4 client tests.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove embedding-based search in preparation for web search"
```

---

### Task 2: CrossRef Search Client

**Files:**
- Create: `app/ollama/crossref.go`
- Create: `app/ollama/crossref_test.go`

**Background:**

CrossRef REST API (no auth required):
```
GET https://api.crossref.org/works?query=<url-encoded-query>&rows=8
```

Response structure (simplified):
```json
{
  "message": {
    "items": [
      {
        "DOI": "10.1000/xyz123",
        "title": ["Paper Title Here"],
        "author": [{"given": "Jane", "family": "Smith"}],
        "published": {"date-parts": [[2021, 3]]},
        "container-title": ["Nature"]
      }
    ]
  }
}
```

**Step 1: Write the failing test**

Create `app/ollama/crossref_test.go`:

```go
package ollama_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"antonelli/app/ollama"
)

func TestSearchCrossRef_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/works" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("query") == "" {
			t.Error("expected query param")
		}
		json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]any{
				"items": []map[string]any{
					{
						"DOI":            "10.1000/test",
						"title":          []string{"A Great Paper"},
						"author":         []map[string]any{{"given": "Jane", "family": "Doe"}},
						"published":      map[string]any{"date-parts": [][]int{{2022}}},
						"container-title": []string{"Nature"},
					},
				},
			},
		})
	}))
	defer srv.Close()

	papers, err := ollama.SearchCrossRef(srv.URL, "machine learning", 8)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(papers) != 1 {
		t.Fatalf("expected 1 paper, got %d", len(papers))
	}
	p := papers[0]
	if p.DOI != "10.1000/test" {
		t.Errorf("DOI: got %q want %q", p.DOI, "10.1000/test")
	}
	if p.Title != "A Great Paper" {
		t.Errorf("Title: got %q want %q", p.Title, "A Great Paper")
	}
	if p.Authors != "Jane Doe" {
		t.Errorf("Authors: got %q want %q", p.Authors, "Jane Doe")
	}
	if p.Year != 2022 {
		t.Errorf("Year: got %d want 2022", p.Year)
	}
	if p.Venue != "Nature" {
		t.Errorf("Venue: got %q want %q", p.Venue, "Nature")
	}
}

func TestSearchCrossRef_Empty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]any{"items": []any{}},
		})
	}))
	defer srv.Close()

	papers, err := ollama.SearchCrossRef(srv.URL, "nothing", 8)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(papers) != 0 {
		t.Errorf("expected 0 papers, got %d", len(papers))
	}
}

func TestSearchCrossRef_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer srv.Close()

	_, err := ollama.SearchCrossRef(srv.URL, "query", 8)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

**Step 2: Run test to verify it fails**

```bash
go test ./app/ollama/... -run TestSearchCrossRef -v
```
Expected: compile error — `ollama.SearchCrossRef` undefined.

**Step 3: Write the implementation**

Create `app/ollama/crossref.go`:

```go
package ollama

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// CrossRefPaper holds the metadata for a single paper returned by CrossRef.
type CrossRefPaper struct {
	Title   string `json:"title"`
	Authors string `json:"authors"`
	Year    int    `json:"year"`
	Venue   string `json:"venue"`
	DOI     string `json:"doi"`
}

// crossRefResponse mirrors the relevant parts of the CrossRef works API response.
type crossRefResponse struct {
	Message struct {
		Items []struct {
			DOI            string     `json:"DOI"`
			Title          []string   `json:"title"`
			Author         []crAuthor `json:"author"`
			Published      crDate     `json:"published"`
			ContainerTitle []string   `json:"container-title"`
		} `json:"items"`
	} `json:"message"`
}

type crAuthor struct {
	Given  string `json:"given"`
	Family string `json:"family"`
}

type crDate struct {
	DateParts [][]int `json:"date-parts"`
}

// SearchCrossRef queries the CrossRef REST API and returns up to rows papers.
// baseURL is normally "https://api.crossref.org" but is overridden in tests.
func SearchCrossRef(baseURL, query string, rows int) ([]CrossRefPaper, error) {
	endpoint := baseURL + "/works?query=" + url.QueryEscape(query) + "&rows=" + strconv.Itoa(rows)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("crossref: build request: %w", err)
	}
	req.Header.Set("User-Agent", "antonelli/1.0 (mailto:antonelli@example.com)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("crossref: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("crossref: returned HTTP %d", resp.StatusCode)
	}

	var cr crossRefResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, fmt.Errorf("crossref: decode response: %w", err)
	}

	papers := make([]CrossRefPaper, 0, len(cr.Message.Items))
	for _, item := range cr.Message.Items {
		title := ""
		if len(item.Title) > 0 {
			title = item.Title[0]
		}
		venue := ""
		if len(item.ContainerTitle) > 0 {
			venue = item.ContainerTitle[0]
		}
		year := 0
		if len(item.Published.DateParts) > 0 && len(item.Published.DateParts[0]) > 0 {
			year = item.Published.DateParts[0][0]
		}
		authors := formatCrossRefSearchAuthors(item.Author)
		papers = append(papers, CrossRefPaper{
			Title:   title,
			Authors: authors,
			Year:    year,
			Venue:   venue,
			DOI:     item.DOI,
		})
	}
	return papers, nil
}

func formatCrossRefSearchAuthors(authors []crAuthor) string {
	names := make([]string, 0, len(authors))
	for _, a := range authors {
		name := strings.TrimSpace(a.Given + " " + a.Family)
		if name != "" {
			names = append(names, name)
		}
	}
	return strings.Join(names, ", ")
}
```

**Step 4: Run tests to verify they pass**

```bash
go test ./app/ollama/... -v
```
Expected: all tests PASS including the 3 new CrossRef tests.

**Step 5: Commit**

```bash
git add app/ollama/crossref.go app/ollama/crossref_test.go
git commit -m "feat: add CrossRef search client"
```

---

### Task 3: StreamGenerate on Ollama Client

**Files:**
- Modify: `app/ollama/client.go`
- Modify: `app/ollama/client_test.go`

**Background:**

Ollama streaming generate endpoint:
```
POST /api/generate
Body: {"model": "...", "prompt": "...", "stream": true}
```

Response: newline-delimited JSON, one object per line:
```
{"model":"...","response":"Hello","done":false}
{"model":"...","response":" world","done":false}
{"model":"...","response":"","done":true}
```

`StreamGenerate` reads each line, parses it, calls `onChunk(token)` for each non-empty `response` field, and returns when `done` is `true` or on error. It accepts a `context.Context` for cancellation (user closing modal mid-stream).

**Step 1: Add the failing test**

Append to `app/ollama/client_test.go`:

```go
func TestStreamGenerate_Success(t *testing.T) {
	chunks := []string{"Hello", " world", "!"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/generate" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/x-ndjson")
		flusher := w.(http.Flusher)
		for i, chunk := range chunks {
			done := i == len(chunks)-1
			json.NewEncoder(w).Encode(map[string]any{
				"response": chunk,
				"done":     done,
			})
			flusher.Flush()
		}
	}))
	defer srv.Close()

	client := ollama.NewClient(srv.URL)
	var got []string
	err := client.StreamGenerate(context.Background(), "test-model", "hello", func(chunk string) {
		got = append(got, chunk)
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Join(got, "") != "Hello world!" {
		t.Errorf("got %q want %q", strings.Join(got, ""), "Hello world!")
	}
}

func TestStreamGenerate_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad model", http.StatusNotFound)
	}))
	defer srv.Close()

	client := ollama.NewClient(srv.URL)
	err := client.StreamGenerate(context.Background(), "bad-model", "hi", func(string) {})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

Also add the missing imports to `client_test.go` — the file needs `"context"` and `"strings"` added to its import block.

**Step 2: Run test to verify it fails**

```bash
go test ./app/ollama/... -run TestStreamGenerate -v
```
Expected: compile error — `StreamGenerate` undefined.

**Step 3: Write the implementation**

Add to `app/ollama/client.go`:

```go
type generateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type generateChunk struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

// StreamGenerate calls Ollama's /api/generate endpoint with streaming enabled.
// It calls onChunk for each token received and returns when the stream is done.
// Cancel ctx to abort mid-stream (e.g. when the user closes the modal).
func (c *Client) StreamGenerate(ctx context.Context, model, prompt string, onChunk func(string)) error {
	body, err := json.Marshal(generateRequest{Model: model, Prompt: prompt, Stream: true})
	if err != nil {
		return fmt.Errorf("ollama: marshal generate request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("ollama: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Use a client without a hard response timeout — streaming can take minutes.
	streamClient := &http.Client{}
	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("ollama: generate request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ollama: generate returned HTTP %d", resp.StatusCode)
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var chunk generateChunk
		if err := decoder.Decode(&chunk); err != nil {
			return fmt.Errorf("ollama: decode chunk: %w", err)
		}
		if chunk.Response != "" {
			onChunk(chunk.Response)
		}
		if chunk.Done {
			return nil
		}
	}
}
```

Also add `"context"` to the import block in `client.go`.

**Step 4: Run tests to verify they pass**

```bash
go test ./app/ollama/... -v
```
Expected: all tests PASS (4 client + 3 crossref + 2 streamgenerate = 9 total).

**Step 5: Commit**

```bash
git add app/ollama/client.go app/ollama/client_test.go
git commit -m "feat: add StreamGenerate to Ollama client"
```

---

### Task 4: OllamaWebSearch App Method

**Files:**
- Modify: `app.go`

**Background:**

`OllamaWebSearch` does four things in sequence:
1. Calls `ollama.SearchCrossRef` with the real CrossRef base URL
2. Emits `ollama:error` and returns if CrossRef fails or returns nothing
3. Builds a prompt from the papers and streams Ollama's response token-by-token via `ollama:chunk` events
4. Emits `ollama:refs` (the CrossRef papers) when the stream completes

The method returns `void` to the frontend — all outcomes (including errors) are communicated via events, so the frontend doesn't need dual error handling.

The system prompt format:
```
You are a research assistant. The user asked: "<query>".

Below are papers from the literature related to this topic.
Write a concise summary of what these papers cover and how they
relate to the user's query. Reference papers by their number [1], [2], etc.

[1] Title: <title>
    Authors: <authors> (<year>)
    Published in: <venue>
    DOI: <doi>

[2] ...
```

**Step 1: Add the import and method to app.go**

Add `"context"` and `"fmt"` and `"strings"` to the import block if not already present. The `"antonelli/app/ollama"` import is already there.

At the end of `app.go`, add:

```go
const crossRefBaseURL = "https://api.crossref.org"

// OllamaWebSearch fetches real papers from CrossRef, then streams an Ollama
// summary into the frontend via Wails events. All outcomes are communicated
// through events so the frontend doesn't need to handle Promise rejections.
//
// Events emitted:
//   - "ollama:chunk" (string)       — one token from the streaming response
//   - "ollama:refs"  ([]CrossRefPaper) — the CrossRef papers (sent after stream ends)
//   - "ollama:error" (string)       — human-readable error message
func (a *App) OllamaWebSearch(query, model, baseURL string) {
	papers, err := ollama.SearchCrossRef(crossRefBaseURL, query, 8)
	if err != nil {
		runtime.EventsEmit(a.ctx, "ollama:error", "CrossRef search failed: "+err.Error())
		return
	}
	if len(papers) == 0 {
		runtime.EventsEmit(a.ctx, "ollama:error", "No papers found for this query.")
		return
	}

	prompt := buildOllamaPrompt(query, papers)
	client := ollama.NewClient(baseURL)

	streamErr := client.StreamGenerate(context.Background(), model, prompt, func(chunk string) {
		runtime.EventsEmit(a.ctx, "ollama:chunk", chunk)
	})
	if streamErr != nil {
		runtime.EventsEmit(a.ctx, "ollama:error", "Ollama stream error: "+streamErr.Error())
	}

	// Emit papers regardless of stream outcome — they came from CrossRef and are real.
	runtime.EventsEmit(a.ctx, "ollama:refs", papers)
}

func buildOllamaPrompt(query string, papers []ollama.CrossRefPaper) string {
	var sb strings.Builder
	sb.WriteString("You are a research assistant. The user asked: \"")
	sb.WriteString(query)
	sb.WriteString("\".\n\n")
	sb.WriteString("Below are papers from the literature related to this topic.\n")
	sb.WriteString("Write a concise summary of what these papers cover and how they\n")
	sb.WriteString("relate to the user's query. Reference papers by their number [1], [2], etc.\n\n")
	for i, p := range papers {
		sb.WriteString(fmt.Sprintf("[%d] Title: %s\n", i+1, p.Title))
		sb.WriteString(fmt.Sprintf("    Authors: %s (%d)\n", p.Authors, p.Year))
		if p.Venue != "" {
			sb.WriteString(fmt.Sprintf("    Published in: %s\n", p.Venue))
		}
		if p.DOI != "" {
			sb.WriteString(fmt.Sprintf("    DOI: %s\n", p.DOI))
		}
		sb.WriteString("\n")
	}
	return sb.String()
}
```

**Step 2: Verify it compiles**

```bash
go build ./app/...
```
Expected: no errors.

**Step 3: Commit**

```bash
git add app.go
git commit -m "feat: add OllamaWebSearch with CrossRef + Ollama streaming"
```

---

### Task 5: Frontend Types and Hook

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/hooks/useReferences.ts`

**Step 1: Add CrossRefPaper type to types.ts**

In `frontend/src/lib/types.ts`, append before `export const ENTRY_TYPES`:

```typescript
export interface CrossRefPaper {
  title: string;
  authors: string;
  year: number;
  venue: string;
  doi: string;
}
```

**Step 2: Update Window.go interface in useReferences.ts**

Replace:
```typescript
          OllamaSearchReferences: (query: string, model: string, baseURL: string) => Promise<any[]>;
          CheckOllamaStatus: (baseURL: string) => Promise<boolean>;
          InvalidateEmbedding: (refID: string) => Promise<void>;
```

With:
```typescript
          OllamaWebSearch: (query: string, model: string, baseURL: string) => Promise<void>;
          CheckOllamaStatus: (baseURL: string) => Promise<boolean>;
```

**Step 3: Replace ollamaSearchReferences with ollamaWebSearch in useReferences.ts**

Replace the `ollamaSearchReferences` callback with:

```typescript
  const ollamaWebSearch = useCallback(
    async (query: string, settings: OllamaSettings) => {
      await window.go.main.App.OllamaWebSearch(query, settings.model, settings.baseURL);
    },
    []
  );
```

In the return object, replace `ollamaSearchReferences` with `ollamaWebSearch`.

**Step 4: Verify frontend compiles**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/useReferences.ts
git commit -m "feat: add CrossRefPaper type and ollamaWebSearch hook"
```

---

### Task 6: OllamaSearchModal Component

**Files:**
- Create: `frontend/src/components/OllamaSearchModal.tsx`

**Background:**

Wails v2 exposes `EventsOn` and `EventsOff` at `../../wailsjs/runtime/runtime`. These are functions:
- `EventsOn(eventName: string, callback: (...data: any[]) => void): () => void` — returns an unsubscribe function
- `EventsOff(...eventNames: string[]): void`

The modal:
1. On open (`open` prop changes to `true`): set up event listeners, then call `ollamaWebSearch(query, ollamaSettings)`
2. Streams tokens into a `<pre>` that auto-scrolls
3. When `ollama:refs` fires: renders import cards at the bottom
4. When `ollama:error` fires: renders an error banner (but keeps any partial text)
5. On close: calls `EventsOff` for all three events and resets state

Each import card has a "Import" button that calls the existing `ImportFromDOI` (from `wailsjs/go/main/App`) and, on success, calls `onImportSuccess` to open the ReferenceForm pre-filled.

**Step 1: Create the component**

Create `frontend/src/components/OllamaSearchModal.tsx`:

```tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReferences } from "@/hooks/useReferences";
import { ImportFromDOI } from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import type { CrossRefPaper, CreateReferenceInput } from "@/lib/types";

interface OllamaSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onImportSuccess: (data: CreateReferenceInput) => void;
}

export function OllamaSearchModal({
  open,
  onOpenChange,
  query,
  onImportSuccess,
}: OllamaSearchModalProps) {
  const [text, setText] = useState("");
  const [papers, setPapers] = useState<CrossRefPaper[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [importingDOI, setImportingDOI] = useState<string | null>(null);
  const textRef = useRef<HTMLPreElement>(null);
  const { ollamaWebSearch, ollamaSettings } = useReferences();

  const reset = useCallback(() => {
    setText("");
    setPapers([]);
    setError(null);
    setIsStreaming(false);
    setImportingDOI(null);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) return;

    reset();
    setIsStreaming(true);

    const offChunk = EventsOn("ollama:chunk", (chunk: string) => {
      setText((prev) => prev + chunk);
    });

    const offRefs = EventsOn("ollama:refs", (refs: CrossRefPaper[]) => {
      setPapers(refs || []);
      setIsStreaming(false);
    });

    const offError = EventsOn("ollama:error", (msg: string) => {
      setError(msg);
      setIsStreaming(false);
    });

    ollamaWebSearch(query, ollamaSettings);

    return () => {
      offChunk();
      offRefs();
      offError();
      EventsOff("ollama:chunk", "ollama:refs", "ollama:error");
    };
  }, [open, query]);

  // Auto-scroll text area as content arrives
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text]);

  const handleImport = async (paper: CrossRefPaper) => {
    if (!paper.doi) return;
    setImportingDOI(paper.doi);
    try {
      const data = await ImportFromDOI(paper.doi);
      onImportSuccess(data);
    } catch {
      // If DOI lookup fails, fall back to a minimal pre-filled form
      onImportSuccess({
        entryType: "misc",
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        venue: paper.venue,
        doi: paper.doi,
      });
    } finally {
      setImportingDOI(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Search: {query}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Streaming text */}
          {(text || isStreaming) && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <pre
                ref={textRef}
                className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm font-sans rounded-md bg-muted p-3 min-h-0"
              >
                {text}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5 align-middle" />
                )}
              </pre>
            </div>
          )}

          {/* Loading state before text arrives */}
          {isStreaming && !text && !error && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching and summarizing...
            </div>
          )}

          {/* Reference cards */}
          {papers.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-64 flex-shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                References ({papers.length})
              </p>
              {papers.map((paper, i) => (
                <div
                  key={paper.doi || i}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug truncate">[{i + 1}] {paper.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {paper.authors}{paper.year ? ` (${paper.year})` : ""}
                      {paper.venue ? ` · ${paper.venue}` : ""}
                    </p>
                    {paper.doi && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                        {paper.doi}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0"
                    disabled={!paper.doi || importingDOI === paper.doi}
                    onClick={() => handleImport(paper)}
                  >
                    {importingDOI === paper.doi ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3 mr-1" />
                    )}
                    Import
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify frontend compiles**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

**Step 3: Commit**

```bash
git add frontend/src/components/OllamaSearchModal.tsx
git commit -m "feat: add OllamaSearchModal with streaming text and import cards"
```

---

### Task 7: Toolbar Wiring

**Files:**
- Modify: `frontend/src/components/Toolbar.tsx`

**Background:**

In AI mode, the search input now triggers on Enter (not debounce). Pressing Enter opens `OllamaSearchModal` with the current search value. The debounce timer is still needed for keyword mode but not AI mode.

The `OllamaSearchModal` `onImportSuccess` callback should populate `importedData` and open `ReferenceForm`, exactly like the existing import flow.

**Step 1: Update Toolbar.tsx**

Make the following changes to `frontend/src/components/Toolbar.tsx`:

**1a. Add imports:**

Add to the existing import line for types:
```typescript
import type { CreateReferenceInput, OllamaSettings } from "@/lib/types";
```
(replace existing `type { CreateReferenceInput }` — `OllamaSettings` is already imported)

Add the new modal import:
```typescript
import { OllamaSearchModal } from "@/components/OllamaSearchModal";
```

**1b. Add state for the AI modal:**

After the existing `isAiSettingsOpen` state, add:
```typescript
  const [isOllamaModalOpen, setIsOllamaModalOpen] = useState(false);
  const [ollamaModalQuery, setOllamaModalQuery] = useState("");
```

**1c. Add Enter key handler for AI mode:**

In the search `<Input>` element, add an `onKeyDown` prop:
```tsx
onKeyDown={(e) => {
  if (isAiMode && e.key === "Enter" && searchValue.trim()) {
    e.preventDefault();
    setOllamaModalQuery(searchValue.trim());
    setIsOllamaModalOpen(true);
  }
}}
```

**1d. Change AI mode debounce to no-op:**

In `handleSearch`, change the debounce callback body so that in AI mode it does nothing (Enter is the trigger):

```typescript
    searchDebounceRef.current = setTimeout(() => {
      if (value.trim() === "") {
        refreshReferences();
      } else if (searchMode === 'ai') {
        // AI search triggers on Enter, not debounce — do nothing here
      } else {
        searchReferences(value);
      }
    }, 300);
```

**1e. Add OllamaSearchModal to the JSX**, after the existing `ImportBibtexModal`:

```tsx
      <OllamaSearchModal
        open={isOllamaModalOpen}
        onOpenChange={setIsOllamaModalOpen}
        query={ollamaModalQuery}
        onImportSuccess={(data) => {
          setImportedData(data);
          setIsOllamaModalOpen(false);
          setIsFormOpen(true);
        }}
      />
```

**Step 2: Verify frontend build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

**Step 3: Run full Go test suite**

```bash
go test ./app/...
```
Expected: all tests pass.

**Step 4: Commit**

```bash
git add frontend/src/components/Toolbar.tsx
git commit -m "feat: wire OllamaSearchModal into Toolbar AI search mode"
```

---

## Manual Testing Checklist

After all tasks complete, test end-to-end with `wails dev`:

1. Switch to AI mode (click search mode toggle) — dot should turn green if Ollama is running
2. Type a query (e.g. "neural networks for text classification") and press Enter
3. Modal opens immediately
4. "Searching and summarizing..." spinner appears briefly
5. Ollama text streams in word-by-word with a blinking cursor
6. When streaming ends, reference cards appear below the text, numbered [1]–[N]
7. Each card shows title, authors, year, venue, and DOI
8. Click "Import" on a card — ReferenceForm opens pre-filled with the paper's data
9. Close modal and try another query — previous results are cleared
10. With Ollama stopped: press Enter in AI mode — modal shows "Ollama is not reachable" error
11. With a very obscure query: modal shows "No papers found for this query"
12. Switch back to keyword mode — normal search works as before
