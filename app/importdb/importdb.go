package importdb

import (
	"encoding/json"
	"fmt"

	"antonelli/app/database"
	"antonelli/app/export"
	"antonelli/app/models"
)

const (
	ModeReplace = "replace"
	ModeMerge   = "merge"
)

const (
	DuplicateStrategyAutoSuffix = "autoSuffix"
	DuplicateStrategySkip      = "skip"
)

// PreviewResult contains duplicate cite keys found during preview.
type PreviewResult struct {
	DuplicateCiteKeys []string `json:"duplicateCiteKeys"`
	ReferenceCount    int      `json:"referenceCount"`
	TagCount          int      `json:"tagCount"`
	FolderCount       int      `json:"folderCount"`
}

// ImportResult summarizes the import operation.
type ImportResult struct {
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
}

// Preview parses the JSON and returns duplicate cite keys (for merge mode).
func Preview(data []byte, repo *database.Repository) (*PreviewResult, error) {
	var exp export.DatabaseExport
	if err := json.Unmarshal(data, &exp); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if exp.Version != export.SchemaVersion {
		return nil, fmt.Errorf("unsupported schema version %d", exp.Version)
	}

	result := &PreviewResult{
		ReferenceCount: len(exp.References),
		TagCount:       len(exp.Tags),
		FolderCount:    len(exp.Folders),
	}

	existingKeys := make(map[string]bool)
	for _, r := range exp.References {
		if r.CiteKey == "" {
			continue
		}
		exists, err := repo.CiteKeyExists(r.CiteKey, "")
		if err != nil {
			return nil, err
		}
		if exists {
			if !existingKeys[r.CiteKey] {
				result.DuplicateCiteKeys = append(result.DuplicateCiteKeys, r.CiteKey)
				existingKeys[r.CiteKey] = true
			}
		}
	}

	return result, nil
}

// Import performs the database import.
func Import(data []byte, mode, duplicateStrategy string, repo *database.Repository) (*ImportResult, error) {
	var exp export.DatabaseExport
	if err := json.Unmarshal(data, &exp); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if exp.Version != export.SchemaVersion {
		return nil, fmt.Errorf("unsupported schema version %d", exp.Version)
	}

	result := &ImportResult{}

	if mode == ModeReplace {
		if err := repo.ClearAll(); err != nil {
			return nil, fmt.Errorf("failed to clear database: %w", err)
		}

		// Insert tags
		for _, t := range exp.Tags {
			if err := repo.InsertTagFull(t.ID, t.Name, t.Color, t.CreatedAt); err != nil {
				return nil, fmt.Errorf("insert tag: %w", err)
			}
		}

		// Insert folders
		for _, f := range exp.Folders {
			if err := repo.InsertFolderFull(f.ID, f.Name, f.CreatedAt); err != nil {
				return nil, fmt.Errorf("insert folder: %w", err)
			}
		}

		// Insert references
		for _, r := range exp.References {
			imp := r.ImportedAt
			if err := repo.InsertReferenceFull(
				r.ID, r.EntryType, r.CiteKey, r.Title, r.Authors, r.Year,
				r.Venue, r.Volume, r.Number, r.Pages, r.DOI, r.URL,
				r.Abstract, r.Keywords, r.Notes, r.RawBibtex, r.GitHubURL,
				r.CreatedAt, r.UpdatedAt, imp,
			); err != nil {
				return nil, fmt.Errorf("insert reference: %w", err)
			}
			result.Imported++
		}

		// Insert associations
		for _, rt := range exp.ReferenceTags {
			if err := repo.InsertReferenceTag(rt.ReferenceID, rt.TagID); err != nil {
				return nil, fmt.Errorf("insert reference_tag: %w", err)
			}
		}
		for _, rf := range exp.RefFolders {
			if err := repo.InsertReferenceFolder(rf.ReferenceID, rf.FolderID); err != nil {
				return nil, fmt.Errorf("insert reference_folder: %w", err)
			}
		}
		for _, rl := range exp.ReferenceLinks {
			if err := repo.InsertReferenceLink(rl.ID, rl.ReferenceID, rl.Label, rl.URL); err != nil {
				return nil, fmt.Errorf("insert reference_link: %w", err)
			}
		}

		return result, nil
	}

	// Merge mode
	duplicateSet := make(map[string]bool)
	for _, r := range exp.References {
		if r.CiteKey == "" {
			continue
		}
		exists, err := repo.CiteKeyExists(r.CiteKey, "")
		if err != nil {
			return nil, err
		}
		if exists {
			duplicateSet[r.CiteKey] = true
		}
	}

	for _, r := range exp.References {
		citeKey := r.CiteKey
		if citeKey != "" && duplicateSet[citeKey] {
			switch duplicateStrategy {
			case DuplicateStrategySkip:
				result.Skipped++
				continue
			case DuplicateStrategyAutoSuffix:
				citeKey = makeUniqueCiteKey(repo, citeKey)
			default:
				return nil, fmt.Errorf("duplicate cite key %q requires resolution", r.CiteKey)
			}
		}

		// Build tag names and folder names from export
		tagNames := make([]string, 0, len(exp.ReferenceTags))
		for _, rt := range exp.ReferenceTags {
			if rt.ReferenceID == r.ID {
				for _, t := range exp.Tags {
					if t.ID == rt.TagID {
						tagNames = append(tagNames, t.Name)
						break
					}
				}
			}
		}
		folderNames := make([]string, 0, len(exp.RefFolders))
		for _, rf := range exp.RefFolders {
			if rf.ReferenceID == r.ID {
				for _, f := range exp.Folders {
					if f.ID == rf.FolderID {
						folderNames = append(folderNames, f.Name)
						break
					}
				}
			}
		}
		links := make([]models.LinkInput, 0, len(exp.ReferenceLinks))
		for _, rl := range exp.ReferenceLinks {
			if rl.ReferenceID == r.ID {
				links = append(links, models.LinkInput{Label: rl.Label, URL: rl.URL})
			}
		}

		input := models.CreateReferenceInput{
			EntryType:  r.EntryType,
			CiteKey:    citeKey,
			Title:      r.Title,
			Authors:    r.Authors,
			Year:       r.Year,
			Venue:      r.Venue,
			Volume:     r.Volume,
			Number:     r.Number,
			Pages:      r.Pages,
			DOI:        r.DOI,
			URL:        r.URL,
			Abstract:   r.Abstract,
			Keywords:   r.Keywords,
			Notes:      r.Notes,
			Tags:       tagNames,
			Folders:    folderNames,
			GitHubURL:  r.GitHubURL,
			Links:      links,
			FromImport: r.ImportedAt != nil,
		}
		if input.Title == "" {
			input.Title = "(Untitled)"
		}

		_, err := repo.Create(input)
		if err != nil {
			return nil, fmt.Errorf("create reference: %w", err)
		}
		result.Imported++
	}

	return result, nil
}

func makeUniqueCiteKey(repo *database.Repository, base string) string {
	for i := 0; ; i++ {
		candidate := base
		if i > 0 {
			if i <= 26 {
				candidate = base + string(rune('a'+i-1))
			} else {
				candidate = fmt.Sprintf("%s_%d", base, i)
			}
		}
		exists, _ := repo.CiteKeyExists(candidate, "")
		if !exists {
			return candidate
		}
	}
}
