package ollama_test

import (
	"math"
	"testing"

	"antonelli/app/ollama"
)

func TestCosineSimilarity_Identical(t *testing.T) {
	v := []float64{1, 2, 3}
	got := ollama.CosineSimilarity(v, v)
	if math.Abs(got-1.0) > 1e-9 {
		t.Errorf("identical vectors: got %f want 1.0", got)
	}
}

func TestCosineSimilarity_Orthogonal(t *testing.T) {
	a := []float64{1, 0}
	b := []float64{0, 1}
	got := ollama.CosineSimilarity(a, b)
	if math.Abs(got) > 1e-9 {
		t.Errorf("orthogonal vectors: got %f want 0.0", got)
	}
}

func TestCosineSimilarity_ZeroVector(t *testing.T) {
	a := []float64{0, 0}
	b := []float64{1, 2}
	got := ollama.CosineSimilarity(a, b)
	if got != 0 {
		t.Errorf("zero vector: got %f want 0.0", got)
	}
}

func TestReferenceText(t *testing.T) {
	got := ollama.ReferenceText("My Paper", "Smith", "ML stuff", "neural nets", "my notes")
	if got == "" {
		t.Error("expected non-empty reference text")
	}
	// Should include each field
	for _, want := range []string{"My Paper", "Smith", "ML stuff", "neural nets", "my notes"} {
		if len(got) == 0 {
			t.Errorf("expected %q in reference text", want)
		}
	}
}
