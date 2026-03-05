# Ollama Web Search Design

## Goal

Replace the embedding-based AI search with a two-step flow: CrossRef fetches real papers matching the query, Ollama summarizes them, and the user can import any result in one click.

## Architecture

```
User types query → presses Enter (not debounce)
        ↓
Go: OllamaWebSearch(query, model, baseURL)
        ↓
  1. Fetch CrossRef: GET api.crossref.org/works?query=<query>&rows=8
     → returns real papers (title, authors, DOI, year, venue)
        ↓
  2. Build prompt:
     "You are a research assistant. Below are papers related to '<query>'.
      Write a concise summary of what these papers cover and how they
      relate to the topic. Reference them by number.

      [1] Title: ... Authors: ... DOI: ...
      [2] ..."
        ↓
  3. POST /api/generate to Ollama (stream: true)
     → emit each token via runtime.EventsEmit(ctx, "ollama:chunk", token)
     → on done: emit runtime.EventsEmit(ctx, "ollama:refs", papers)
        ↓
Frontend: OllamaSearchModal
  - Appends tokens to scrolling text area as they arrive
  - On "ollama:refs": renders import cards at bottom
  - Each card: title + authors + DOI + "Import" button
  - Import triggers existing ImportFromDOI → opens ReferenceForm pre-filled
```

## Components

### Backend

- `app/ollama/client.go` — add `StreamGenerate(ctx, model, prompt, onChunk)` using POST `/api/generate` with `stream: true`, reading newline-delimited JSON chunks
- `app/ollama/crossref.go` — new CrossRef search client: `SearchCrossRef(query string, rows int) ([]CrossRefPaper, error)`; reuses `net/http` pattern from `app/importer/doi.go`
- `app.go` — replace `OllamaSearchReferences` / `InvalidateEmbedding` / `scoredRef` with `OllamaWebSearch(query, model, baseURL string) error`; remove embedding invalidation from `UpdateReference`

### Frontend

- `frontend/src/components/OllamaSearchModal.tsx` — new modal; listens to `ollama:chunk` / `ollama:refs` / `ollama:error` Wails events; streams text into scrolling area; renders import cards below
- `frontend/src/components/Toolbar.tsx` — AI mode search triggers on Enter (not debounce); opens modal and calls `OllamaWebSearch`
- `frontend/src/hooks/useReferences.ts` — replace `ollamaSearchReferences` with `ollamaWebSearch`; keep `checkOllamaStatus`, `searchMode`, `ollamaSettings`

### Removed

- `app/database/embedding_repository.go`
- `app/ollama/search.go` + `search_test.go`
- `ref_embeddings` migration in `app/database/sqlite.go`

## Wails Event Protocol

| Event | Payload | Meaning |
|-------|---------|---------|
| `ollama:chunk` | `string` | Next streamed token from Ollama |
| `ollama:refs` | `[]CrossRefPaper` | CrossRef results; sent once after stream completes |
| `ollama:error` | `string` | Error message; modal shows banner |

## System Prompt

```
You are a research assistant. The user asked: "<query>".

Below are papers from the literature related to this topic.
Write a concise summary of what these papers cover and how they
relate to the user's query. Reference papers by their number [1], [2], etc.

<numbered list of CrossRefPaper: title, authors, year, venue, DOI>
```

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| CrossRef returns no results | Modal shows "No papers found for this query"; no Ollama call |
| CrossRef request fails | Modal shows error message; no cards |
| Ollama unavailable | Modal shows "Ollama is not reachable — check your settings" |
| Stream interrupted mid-response | Show partial text + error banner; still render CrossRef cards |
| User closes modal mid-stream | Context cancellation stops in-flight stream on Go side |
| DOI import fails | Existing `ImportFromDOI` error handling surfaces it in ReferenceForm |

## CrossRefPaper Type

```go
type CrossRefPaper struct {
    Title   string `json:"title"`
    Authors string `json:"authors"`
    Year    int    `json:"year"`
    Venue   string `json:"venue"`
    DOI     string `json:"doi"`
}
```
