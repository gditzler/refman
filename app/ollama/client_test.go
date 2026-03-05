package ollama_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"antonelli/app/ollama"
)

func TestGetEmbedding_Success(t *testing.T) {
	want := []float64{0.1, 0.2, 0.3}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/embed" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"embeddings": [][]float64{want},
		})
	}))
	defer srv.Close()

	client := ollama.NewClient(srv.URL)
	got, err := client.GetEmbedding("qwen:1.8b-chat-q4_0", "hello world")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != len(want) {
		t.Fatalf("len mismatch: got %d want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("got[%d]=%f want %f", i, got[i], want[i])
		}
	}
}

func TestGetEmbedding_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "model not found", http.StatusNotFound)
	}))
	defer srv.Close()

	client := ollama.NewClient(srv.URL)
	_, err := client.GetEmbedding("missing-model", "hello")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestIsAvailable_True(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Ollama is running"))
	}))
	defer srv.Close()

	client := ollama.NewClient(srv.URL)
	if !client.IsAvailable() {
		t.Fatal("expected IsAvailable() = true")
	}
}

func TestIsAvailable_False(t *testing.T) {
	client := ollama.NewClient("http://127.0.0.1:1") // nothing listening
	if client.IsAvailable() {
		t.Fatal("expected IsAvailable() = false")
	}
}
