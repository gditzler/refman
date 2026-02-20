package importer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"antonelli/app/models"
)

type ISBNClient struct {
	httpClient *http.Client
}

func NewISBNClient() *ISBNClient {
	return &ISBNClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

var isbnRegex = regexp.MustCompile(`^(\d{10}|\d{13})$`)

type openLibraryBook struct {
	Title       string        `json:"title"`
	Authors     []authorRef   `json:"authors"`
	Publishers  []string      `json:"publishers"`
	PublishDate string        `json:"publish_date"`
	NumberPages int           `json:"number_of_pages"`
}

type authorRef struct {
	Key string `json:"key"`
}

type openLibraryAuthor struct {
	Name string `json:"name"`
}

func (c *ISBNClient) Fetch(isbn string) (*models.CreateReferenceInput, error) {
	isbn = strings.ReplaceAll(isbn, "-", "")
	isbn = strings.TrimSpace(isbn)

	if !isbnRegex.MatchString(isbn) {
		return nil, ErrInvalidID
	}

	url := fmt.Sprintf("https://openlibrary.org/isbn/%s.json", isbn)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, ErrAPIUnavailable
	}
	req.Header.Set("User-Agent", "antonelli/1.0 (reference manager)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, ErrAPIUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, ErrNotFound
	}
	if resp.StatusCode != 200 {
		return nil, ErrAPIUnavailable
	}

	var book openLibraryBook
	if err := json.NewDecoder(resp.Body).Decode(&book); err != nil {
		return nil, ErrAPIUnavailable
	}

	authors := c.fetchAuthors(book.Authors)
	year := extractYearFromString(book.PublishDate)
	publisher := ""
	if len(book.Publishers) > 0 {
		publisher = book.Publishers[0]
	}

	return &models.CreateReferenceInput{
		EntryType: "book",
		Title:     book.Title,
		Authors:   authors,
		Year:      year,
		Venue:     publisher,
		URL:       fmt.Sprintf("https://openlibrary.org/isbn/%s", isbn),
	}, nil
}

func (c *ISBNClient) fetchAuthors(authorRefs []authorRef) string {
	names := make([]string, 0, len(authorRefs))
	for _, ref := range authorRefs {
		url := fmt.Sprintf("https://openlibrary.org%s.json", ref.Key)
		resp, err := c.httpClient.Get(url)
		if err != nil {
			continue
		}

		var a openLibraryAuthor
		if json.NewDecoder(resp.Body).Decode(&a) == nil && a.Name != "" {
			names = append(names, a.Name)
		}
		resp.Body.Close()
	}
	return strings.Join(names, " and ")
}

func extractYearFromString(date string) int {
	yearRegex := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	match := yearRegex.FindString(date)
	if match != "" {
		var year int
		fmt.Sscanf(match, "%d", &year)
		return year
	}
	return 0
}
