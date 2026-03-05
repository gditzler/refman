package ollama

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client is an HTTP client for the Ollama REST API.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new Client targeting baseURL (e.g. "http://localhost:11434").
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // embedding can be slow for large text
		},
	}
}

type embedRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type embedResponse struct {
	Embeddings [][]float64 `json:"embeddings"`
}

// GetEmbedding returns the embedding vector for the given text using the specified model.
func (c *Client) GetEmbedding(model, text string) ([]float64, error) {
	body, err := json.Marshal(embedRequest{Model: model, Input: text})
	if err != nil {
		return nil, fmt.Errorf("ollama: marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/embed", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ollama: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama: embed returned HTTP %d", resp.StatusCode)
	}

	var result embedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ollama: decode response: %w", err)
	}
	if len(result.Embeddings) == 0 || len(result.Embeddings[0]) == 0 {
		return nil, fmt.Errorf("ollama: empty embedding in response")
	}
	return result.Embeddings[0], nil
}

// IsAvailable reports whether Ollama is reachable at the configured base URL.
func (c *Client) IsAvailable() bool {
	checkClient := &http.Client{Timeout: 3 * time.Second}
	resp, err := checkClient.Get(c.baseURL + "/")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
