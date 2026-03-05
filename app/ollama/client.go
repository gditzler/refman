package ollama

import (
	"bytes"
	"context"
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
