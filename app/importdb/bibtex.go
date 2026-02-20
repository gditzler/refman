package importdb

import (
	"antonelli/app/database"
	"antonelli/app/importer"
	"antonelli/app/models"
)

// BibtexPreviewResult contains parsed refs and duplicate cite keys.
type BibtexPreviewResult struct {
	Refs              []models.CreateReferenceInput `json:"refs"`
	DuplicateCiteKeys  []string                     `json:"duplicateCiteKeys"`
}

// PreviewBibtex parses a BibTeX file and returns refs plus duplicate cite keys.
func PreviewBibtex(filePath string, repo *database.Repository) (*BibtexPreviewResult, error) {
	refs, err := importer.ParseBibtexFile(filePath)
	if err != nil {
		return nil, err
	}

	result := &BibtexPreviewResult{Refs: refs}
	seen := make(map[string]bool)

	for _, r := range refs {
		if r.CiteKey == "" {
			continue
		}
		exists, err := repo.CiteKeyExists(r.CiteKey, "")
		if err != nil {
			return nil, err
		}
		if exists && !seen[r.CiteKey] {
			result.DuplicateCiteKeys = append(result.DuplicateCiteKeys, r.CiteKey)
			seen[r.CiteKey] = true
		}
	}

	return result, nil
}

// ImportBibtex imports references from a BibTeX file with duplicate strategy.
func ImportBibtex(filePath string, duplicateStrategy string, repo *database.Repository, createFn func(models.CreateReferenceInput) (*models.Reference, error)) (*ImportResult, error) {
	refs, err := importer.ParseBibtexFile(filePath)
	if err != nil {
		return nil, err
	}

	result := &ImportResult{}
	duplicateSet := make(map[string]bool)

	for _, r := range refs {
		if r.CiteKey != "" {
			exists, err := repo.CiteKeyExists(r.CiteKey, "")
			if err != nil {
				return nil, err
			}
			if exists {
				duplicateSet[r.CiteKey] = true
			}
		}
	}

	for _, r := range refs {
		citeKey := r.CiteKey
		if citeKey != "" && duplicateSet[citeKey] {
			switch duplicateStrategy {
			case DuplicateStrategySkip:
				result.Skipped++
				continue
			case DuplicateStrategyAutoSuffix:
				citeKey = makeUniqueCiteKey(repo, citeKey)
			default:
				return nil, nil // User cancelled
			}
		}
		r.CiteKey = citeKey
		if r.Title == "" {
			r.Title = "(Untitled)"
		}

		_, err := createFn(r)
		if err != nil {
			return nil, err
		}
		result.Imported++
	}

	return result, nil
}
