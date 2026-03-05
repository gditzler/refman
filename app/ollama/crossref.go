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
