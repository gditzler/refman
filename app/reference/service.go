package reference

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"antonelli/app/database"
	"antonelli/app/models"
)

type Service struct {
	repo *database.Repository
}

func NewService(repo *database.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(input models.CreateReferenceInput) (*models.Reference, error) {
	if errors := ValidateCreate(input); len(errors) > 0 {
		return nil, errors
	}

	if input.CiteKey == "" {
		input.CiteKey = s.generateCiteKey(input.Authors, input.Year)
	}

	exists, err := s.repo.CiteKeyExists(input.CiteKey, "")
	if err != nil {
		return nil, fmt.Errorf("failed to check cite key: %w", err)
	}
	if exists {
		input.CiteKey = s.makeUniqueCiteKey(input.CiteKey)
	}

	ref, err := s.repo.Create(input)
	if err != nil {
		return nil, err
	}

	if len(input.Tags) > 0 {
		if err := s.repo.SetReferenceTags(ref.ID, input.Tags); err != nil {
			return nil, fmt.Errorf("failed to set tags: %w", err)
		}
	}

	if len(input.Folders) > 0 {
		if err := s.repo.SetReferenceFolders(ref.ID, input.Folders); err != nil {
			return nil, fmt.Errorf("failed to set folders: %w", err)
		}
	}

	if len(input.Links) > 0 {
		if err := s.repo.SetReferenceLinks(ref.ID, input.Links); err != nil {
			return nil, fmt.Errorf("failed to set links: %w", err)
		}
	}

	return s.repo.GetByID(ref.ID)
}

func (s *Service) GetByID(id string) (*models.Reference, error) {
	return s.repo.GetByID(id)
}

func (s *Service) GetAll() ([]models.Reference, error) {
	return s.repo.GetAll()
}

func (s *Service) Update(input models.UpdateReferenceInput) (*models.Reference, error) {
	if errors := ValidateUpdate(input); len(errors) > 0 {
		return nil, errors
	}

	if input.CiteKey != "" {
		exists, err := s.repo.CiteKeyExists(input.CiteKey, input.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to check cite key: %w", err)
		}
		if exists {
			return nil, models.NewAppError(
				models.ErrCodeCiteKeyCollision,
				fmt.Sprintf("Cite key \"%s\" is already in use by another reference.", input.CiteKey),
				true,
			)
		}
	}

	ref, err := s.repo.Update(input)
	if err != nil {
		return nil, err
	}

	if err := s.repo.SetReferenceTags(ref.ID, input.Tags); err != nil {
		return nil, fmt.Errorf("failed to set tags: %w", err)
	}

	folders := input.Folders
	if folders == nil {
		folders = []string{}
	}
	if err := s.repo.SetReferenceFolders(ref.ID, folders); err != nil {
		return nil, fmt.Errorf("failed to set folders: %w", err)
	}

	links := input.Links
	if links == nil {
		links = []models.LinkInput{}
	}
	if err := s.repo.SetReferenceLinks(ref.ID, links); err != nil {
		return nil, fmt.Errorf("failed to set links: %w", err)
	}

	s.repo.DeleteUnusedTags()

	return s.repo.GetByID(ref.ID)
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *Service) Search(query string) ([]models.Reference, error) {
	if strings.TrimSpace(query) == "" {
		return s.GetAll()
	}
	return s.repo.Search(query)
}

func (s *Service) generateCiteKey(authors string, year int) string {
	lastName := extractFirstAuthorLastName(authors)
	if lastName == "" {
		lastName = "Unknown"
	}

	citeKey := fmt.Sprintf("%s%d", lastName, year)
	citeKey = sanitizeCiteKey(citeKey)

	return citeKey
}

func (s *Service) makeUniqueCiteKey(baseKey string) string {
	for _, suffix := range "abcdefghijklmnopqrstuvwxyz" {
		candidate := baseKey + string(suffix)
		exists, err := s.repo.CiteKeyExists(candidate, "")
		if err != nil || !exists {
			return candidate
		}
	}
	return baseKey + "1"
}

func extractFirstAuthorLastName(authors string) string {
	if authors == "" {
		return ""
	}

	firstAuthor := strings.Split(authors, ",")[0]
	firstAuthor = strings.Split(firstAuthor, " and ")[0]
	firstAuthor = strings.TrimSpace(firstAuthor)

	parts := strings.Fields(firstAuthor)
	if len(parts) == 0 {
		return ""
	}

	return parts[len(parts)-1]
}

func sanitizeCiteKey(key string) string {
	reg := regexp.MustCompile(`[^a-zA-Z0-9]`)
	key = reg.ReplaceAllString(key, "")

	if len(key) > 0 && !unicode.IsLetter(rune(key[0])) {
		key = "ref" + key
	}

	return key
}
