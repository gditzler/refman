package database

import (
	"fmt"
	"time"
)

// ClearAll removes all data from the database (for replace import).
func (r *Repository) ClearAll() error {
	tables := []string{
		"reference_links", "reference_tags", "reference_folders",
		"refs", "tags", "folders",
	}
	for _, t := range tables {
		if _, err := r.db.Conn().Exec("DELETE FROM " + t); err != nil {
			return fmt.Errorf("failed to clear %s: %w", t, err)
		}
	}
	return nil
}

// InsertReferenceFull inserts a reference with all fields (for import).
func (r *Repository) InsertReferenceFull(id, entryType, citeKey, title, authors string, year int, venue, volume, number, pages, doi, url, abstract, keywords, notes, rawBibtex, githubURL string, createdAt, updatedAt time.Time, importedAt *time.Time) error {
	var imp interface{}
	if importedAt != nil {
		imp = importedAt
	}
	query := `
		INSERT INTO refs (
			id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			raw_bibtex, github_url, created_at, updated_at, imported_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Conn().Exec(query,
		id, entryType, citeKey, title, authors, year, venue,
		volume, number, pages, doi, url, abstract, keywords, notes,
		rawBibtex, githubURL, createdAt, updatedAt, imp,
	)
	return err
}

// InsertTagFull inserts a tag with given id (for import).
func (r *Repository) InsertTagFull(id, name, color string, createdAt time.Time) error {
	_, err := r.db.Conn().Exec(
		"INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
		id, name, color, createdAt,
	)
	return err
}

// InsertFolderFull inserts a folder with given id (for import).
func (r *Repository) InsertFolderFull(id, name string, createdAt time.Time) error {
	_, err := r.db.Conn().Exec(
		"INSERT OR REPLACE INTO folders (id, name, created_at) VALUES (?, ?, ?, ?)",
		id, name, createdAt,
	)
	return err
}

// InsertReferenceTag associates a reference with a tag (for import).
func (r *Repository) InsertReferenceTag(refID, tagID string) error {
	_, err := r.db.Conn().Exec(
		"INSERT OR IGNORE INTO reference_tags (reference_id, tag_id) VALUES (?, ?)",
		refID, tagID,
	)
	return err
}

// InsertReferenceFolder associates a reference with a folder (for import).
func (r *Repository) InsertReferenceFolder(refID, folderID string) error {
	_, err := r.db.Conn().Exec(
		"INSERT OR IGNORE INTO reference_folders (reference_id, folder_id) VALUES (?, ?)",
		refID, folderID,
	)
	return err
}

// InsertReferenceLink inserts a link (for import).
func (r *Repository) InsertReferenceLink(id, refID, label, url string) error {
	_, err := r.db.Conn().Exec(
		"INSERT INTO reference_links (id, reference_id, label, url) VALUES (?, ?, ?, ?)",
		id, refID, label, url,
	)
	return err
}
