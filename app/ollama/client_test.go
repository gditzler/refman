package ollama_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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
