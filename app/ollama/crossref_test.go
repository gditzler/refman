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
						"DOI":             "10.1000/test",
						"title":           []string{"A Great Paper"},
						"author":          []map[string]any{{"given": "Jane", "family": "Doe"}},
						"published":       map[string]any{"date-parts": [][]int{{2022}}},
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
