package importer

import (
	"context"
	"regexp"
	"strings"
	"time"

	"antonelli/app/models"

	"github.com/mtreilly/goarxiv"
)

type ArxivClient struct{}

func NewArxivClient() *ArxivClient {
	return &ArxivClient{}
}

var arxivIDRegex = regexp.MustCompile(`^(\d{4}\.\d{4,5})(v\d+)?$|^[a-z-]+/\d{7}$`)

func (c *ArxivClient) Fetch(arxivID string) (*models.CreateReferenceInput, error) {
	arxivID = strings.TrimPrefix(arxivID, "arXiv:")
	arxivID = strings.TrimSpace(arxivID)

	if !arxivIDRegex.MatchString(arxivID) {
		return nil, ErrInvalidID
	}

	client, err := goarxiv.New()
	if err != nil {
		return nil, ErrAPIUnavailable
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	results, err := client.Search(ctx, "id:"+arxivID, nil)
	if err != nil {
		return nil, ErrAPIUnavailable
	}

	if len(results.Articles) == 0 {
		return nil, ErrNotFound
	}

	article := results.Articles[0]

	year := 0
	if !article.Published.IsZero() {
		year = article.Published.Year()
	}

	authors := formatArxivAuthors(article.Authors)

	return &models.CreateReferenceInput{
		EntryType: "article",
		Title:     strings.TrimSpace(article.Title),
		Authors:   authors,
		Year:      year,
		URL:       "https://arxiv.org/abs/" + arxivID,
		Abstract:  strings.TrimSpace(article.Summary),
		Venue:     "arXiv preprint",
	}, nil
}

func formatArxivAuthors(authors []goarxiv.Author) string {
	names := make([]string, len(authors))
	for i, a := range authors {
		names[i] = a.Name
	}
	return strings.Join(names, " and ")
}
