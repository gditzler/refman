package importer

import (
	"errors"

	"antonelli/app/models"
)

var (
	ErrNotFound       = errors.New("identifier not found")
	ErrInvalidID      = errors.New("invalid identifier format")
	ErrAPIUnavailable = errors.New("external API unavailable")
)

type Service struct {
	arxiv *ArxivClient
	doi   *DOIClient
	isbn  *ISBNClient
}

func NewService() *Service {
	return &Service{
		arxiv: NewArxivClient(),
		doi:   NewDOIClient(),
		isbn:  NewISBNClient(),
	}
}

func (s *Service) ImportFromArxiv(arxivID string) (*models.CreateReferenceInput, error) {
	return s.arxiv.Fetch(arxivID)
}

func (s *Service) ImportFromDOI(doi string) (*models.CreateReferenceInput, error) {
	return s.doi.Fetch(doi)
}

func (s *Service) ImportFromISBN(isbn string) (*models.CreateReferenceInput, error) {
	return s.isbn.Fetch(isbn)
}
