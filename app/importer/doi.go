package importer

import (
	"regexp"
	"strings"

	"antonelli/app/models"

	"github.com/caltechlibrary/crossrefapi"
)

type DOIClient struct{}

func NewDOIClient() *DOIClient {
	return &DOIClient{}
}

var doiRegex = regexp.MustCompile(`^10\.\d{4,}/[^\s]+$`)

func (c *DOIClient) Fetch(doi string) (*models.CreateReferenceInput, error) {
	doi = strings.TrimPrefix(doi, "https://doi.org/")
	doi = strings.TrimPrefix(doi, "http://doi.org/")
	doi = strings.TrimPrefix(doi, "doi:")
	doi = strings.TrimSpace(doi)

	if !doiRegex.MatchString(doi) {
		return nil, ErrInvalidID
	}

	client, err := crossrefapi.NewCrossRefClient("antonelli", "antonelli@example.com")
	if err != nil {
		return nil, ErrAPIUnavailable
	}

	work, err := client.Works(doi)
	if err != nil {
		return nil, ErrNotFound
	}

	if work == nil || work.Message == nil {
		return nil, ErrNotFound
	}

	msg := work.Message
	entryType := mapCrossRefType(msg.Type)
	authors := formatCrossRefAuthors(msg.Author)
	year := extractCrossRefYear(msg.Issued)
	venue := extractCrossRefVenue(msg)

	return &models.CreateReferenceInput{
		EntryType: entryType,
		Title:     strings.Join(msg.Title, " "),
		Authors:   authors,
		Year:      year,
		Venue:     venue,
		Volume:    msg.Volume,
		Number:    msg.Issue,
		Pages:     msg.Page,
		DOI:       doi,
		URL:       "https://doi.org/" + doi,
	}, nil
}

func mapCrossRefType(crType string) string {
	switch crType {
	case "journal-article":
		return "article"
	case "book", "monograph":
		return "book"
	case "proceedings-article":
		return "inproceedings"
	case "book-chapter":
		return "incollection"
	case "dissertation":
		return "phdthesis"
	default:
		return "misc"
	}
}

func formatCrossRefAuthors(authors []*crossrefapi.Person) string {
	names := make([]string, len(authors))
	for i, a := range authors {
		name := strings.TrimSpace(a.Given + " " + a.Family)
		names[i] = name
	}
	return strings.Join(names, " and ")
}

func extractCrossRefYear(issued *crossrefapi.DateObject) int {
	if issued != nil && issued.DateParts != nil && len(issued.DateParts) > 0 {
		if len(issued.DateParts[0]) > 0 {
			return issued.DateParts[0][0]
		}
	}
	return 0
}

func extractCrossRefVenue(msg *crossrefapi.Message) string {
	if len(msg.ContainerTitle) > 0 {
		return msg.ContainerTitle[0]
	}
	return ""
}
