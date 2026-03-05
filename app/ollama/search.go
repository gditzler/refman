package ollama

import (
	"fmt"
	"math"
	"strings"
)

// CosineSimilarity returns the cosine similarity between two equal-length vectors.
// Returns 0 if either vector is all zeros.
func CosineSimilarity(a, b []float64) float64 {
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// ReferenceText builds the text to embed for a reference.
// It concatenates the semantically rich fields: title, authors, abstract, keywords, notes.
func ReferenceText(title, authors, abstract, keywords, notes string) string {
	parts := []string{}
	if title != "" {
		parts = append(parts, fmt.Sprintf("Title: %s", title))
	}
	if authors != "" {
		parts = append(parts, fmt.Sprintf("Authors: %s", authors))
	}
	if abstract != "" {
		parts = append(parts, fmt.Sprintf("Abstract: %s", abstract))
	}
	if keywords != "" {
		parts = append(parts, fmt.Sprintf("Keywords: %s", keywords))
	}
	if notes != "" {
		parts = append(parts, fmt.Sprintf("Notes: %s", notes))
	}
	return strings.Join(parts, "\n")
}
