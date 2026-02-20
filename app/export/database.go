package export

import (
	"encoding/json"
	"time"

	"antonelli/app/database"
	"antonelli/app/models"
)

const SchemaVersion = 1

// DatabaseExport is the JSON structure for full database export.
type DatabaseExport struct {
	Version       int                    `json:"version"`
	ExportedAt    time.Time              `json:"exportedAt"`
	References    []ReferenceExport      `json:"references"`
	Tags          []TagExport            `json:"tags"`
	Folders       []FolderExport         `json:"folders"`
	ReferenceTags []ReferenceTagExport   `json:"referenceTags"`
	RefFolders    []ReferenceFolderExport `json:"referenceFolders"`
	ReferenceLinks []ReferenceLinkExport `json:"referenceLinks"`
}

type ReferenceExport struct {
	ID          string     `json:"id"`
	EntryType   string     `json:"entryType"`
	CiteKey     string     `json:"citeKey"`
	Title       string     `json:"title"`
	Authors     string     `json:"authors"`
	Year        int        `json:"year"`
	Venue       string     `json:"venue"`
	Volume      string     `json:"volume"`
	Number      string     `json:"number"`
	Pages       string     `json:"pages"`
	DOI         string     `json:"doi"`
	URL         string     `json:"url"`
	Abstract    string     `json:"abstract"`
	Keywords    string     `json:"keywords"`
	Notes       string     `json:"notes"`
	RawBibtex   string     `json:"rawBibtex"`
	GitHubURL   string     `json:"githubUrl"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	ImportedAt  *time.Time `json:"importedAt,omitempty"`
}

type TagExport struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
}

type FolderExport struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type ReferenceTagExport struct {
	ReferenceID string `json:"referenceId"`
	TagID      string `json:"tagId"`
}

type ReferenceFolderExport struct {
	ReferenceID string `json:"referenceId"`
	FolderID   string `json:"folderId"`
}

type ReferenceLinkExport struct {
	ID          string `json:"id"`
	ReferenceID string `json:"referenceId"`
	Label       string `json:"label"`
	URL         string `json:"url"`
}

// ToJSON serializes the full database to JSON.
func ToJSON(repo *database.Repository) ([]byte, error) {
	refs, err := repo.GetAll()
	if err != nil {
		return nil, err
	}

	tags, err := repo.GetAllTags()
	if err != nil {
		return nil, err
	}

	folders, err := repo.GetAllFolders()
	if err != nil {
		return nil, err
	}

	exp := DatabaseExport{
		Version:    SchemaVersion,
		ExportedAt: time.Now().UTC(),
	}

	for _, r := range refs {
		exp.References = append(exp.References, refToExport(r))
	}

	for _, t := range tags {
		exp.Tags = append(exp.Tags, TagExport{
			ID:        t.ID,
			Name:      t.Name,
			Color:     t.Color,
			CreatedAt: t.CreatedAt,
		})
	}

	for _, f := range folders {
		exp.Folders = append(exp.Folders, FolderExport{
			ID:        f.ID,
			Name:      f.Name,
			CreatedAt: f.CreatedAt,
		})
	}

	for _, r := range refs {
		for _, t := range r.Tags {
			exp.ReferenceTags = append(exp.ReferenceTags, ReferenceTagExport{
				ReferenceID: r.ID,
				TagID:      t.ID,
			})
		}
		for _, f := range r.Folders {
			exp.RefFolders = append(exp.RefFolders, ReferenceFolderExport{
				ReferenceID: r.ID,
				FolderID:   f.ID,
			})
		}
		for _, l := range r.Links {
			exp.ReferenceLinks = append(exp.ReferenceLinks, ReferenceLinkExport{
				ID:          l.ID,
				ReferenceID: l.ReferenceID,
				Label:       l.Label,
				URL:         l.URL,
			})
		}
	}

	return json.MarshalIndent(exp, "", "  ")
}

func refToExport(r models.Reference) ReferenceExport {
	return ReferenceExport{
		ID:         r.ID,
		EntryType:  r.EntryType,
		CiteKey:    r.CiteKey,
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
		RawBibtex:  r.RawBibtex,
		GitHubURL:  r.GitHubURL,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
		ImportedAt: r.ImportedAt,
	}
}
