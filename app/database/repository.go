package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"antonelli/app/models"

	"github.com/google/uuid"
)

type Repository struct {
	db *DB
}

func NewRepository(db *DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(input models.CreateReferenceInput) (*models.Reference, error) {
	id := uuid.New().String()
	now := time.Now()

	var importedAt interface{}
	if input.FromImport {
		importedAt = now
	}

	query := `
		INSERT INTO refs (
			id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			github_url, created_at, updated_at, imported_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := r.db.Conn().Exec(query,
		id, input.EntryType, input.CiteKey, input.Title, input.Authors,
		input.Year, input.Venue, input.Volume, input.Number, input.Pages,
		input.DOI, input.URL, input.Abstract, input.Keywords, input.Notes,
		input.GitHubURL, now, now, importedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create reference: %w", err)
	}

	return r.GetByID(id)
}

func (r *Repository) GetByID(id string) (*models.Reference, error) {
	query := `
		SELECT id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			raw_bibtex, COALESCE(github_url, ''), created_at, updated_at, imported_at
		FROM refs WHERE id = ?
	`

	ref := &models.Reference{}
	var citeKey, authors, venue, volume, number, pages, doi, url, abstract, keywords, notes, rawBibtex, githubURL sql.NullString
	var year sql.NullInt64
	var importedAt sql.NullTime

	err := r.db.Conn().QueryRow(query, id).Scan(
		&ref.ID, &ref.EntryType, &citeKey, &ref.Title, &authors,
		&year, &venue, &volume, &number, &pages, &doi, &url,
		&abstract, &keywords, &notes, &rawBibtex, &githubURL, &ref.CreatedAt, &ref.UpdatedAt, &importedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("reference not found: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get reference: %w", err)
	}

	ref.CiteKey = citeKey.String
	ref.Authors = authors.String
	ref.Year = int(year.Int64)
	ref.Venue = venue.String
	ref.Volume = volume.String
	ref.Number = number.String
	ref.Pages = pages.String
	ref.DOI = doi.String
	ref.URL = url.String
	ref.Abstract = abstract.String
	ref.Keywords = keywords.String
	ref.Notes = notes.String
	ref.RawBibtex = rawBibtex.String
	ref.GitHubURL = githubURL.String
	if importedAt.Valid {
		ref.ImportedAt = &importedAt.Time
	}

	tags, err := r.GetTagsForReference(id)
	if err != nil {
		return nil, err
	}
	ref.Tags = tags

	folders, err := r.GetFoldersForReference(id)
	if err != nil {
		return nil, err
	}
	ref.Folders = folders

	links, err := r.GetLinksForReference(id)
	if err != nil {
		return nil, err
	}
	ref.Links = links

	return ref, nil
}

func (r *Repository) GetAll() ([]models.Reference, error) {
	query := `
		SELECT id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			raw_bibtex, COALESCE(github_url, ''), created_at, updated_at, imported_at
		FROM refs ORDER BY created_at DESC
	`

	rows, err := r.db.Conn().Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get references: %w", err)
	}
	defer rows.Close()

	refs, err := r.scanReferences(rows)
	if err != nil {
		return nil, err
	}

	for i := range refs {
		tags, err := r.GetTagsForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Tags = tags

		folders, err := r.GetFoldersForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Folders = folders

		links, err := r.GetLinksForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Links = links
	}

	return refs, nil
}

func (r *Repository) Update(input models.UpdateReferenceInput) (*models.Reference, error) {
	now := time.Now()

	query := `
		UPDATE refs SET
			entry_type = ?, cite_key = ?, title = ?, authors = ?, year = ?,
			venue = ?, volume = ?, number = ?, pages = ?, doi = ?, url = ?,
			abstract = ?, keywords = ?, notes = ?, github_url = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := r.db.Conn().Exec(query,
		input.EntryType, input.CiteKey, input.Title, input.Authors, input.Year,
		input.Venue, input.Volume, input.Number, input.Pages, input.DOI, input.URL,
		input.Abstract, input.Keywords, input.Notes, input.GitHubURL, now, input.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update reference: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, fmt.Errorf("reference not found: %s", input.ID)
	}

	return r.GetByID(input.ID)
}

func (r *Repository) Delete(id string) error {
	result, err := r.db.Conn().Exec("DELETE FROM refs WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete reference: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("reference not found: %s", id)
	}

	return nil
}

func (r *Repository) Search(query string) ([]models.Reference, error) {
	if !r.db.FTS5Available() {
		return r.searchLike(query)
	}

	// FTS5 full-text search across title, authors, cite_key, venue, abstract, keywords, notes.
	// Prefix wildcard (*) lets partial terms like "transf" match "transformer".
	// Use a rowid subquery — the correct pattern for FTS5 content= tables.
	sqlQuery := `
		SELECT id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			raw_bibtex, COALESCE(github_url, ''), created_at, updated_at, imported_at
		FROM refs
		WHERE rowid IN (SELECT rowid FROM refs_fts WHERE refs_fts MATCH ?)
		ORDER BY created_at DESC
	`

	// Quote the query to neutralise special FTS5 characters, then add prefix wildcard.
	ftsQuery := `"` + strings.ReplaceAll(query, `"`, `""`) + `"*`
	rows, err := r.db.Conn().Query(sqlQuery, ftsQuery)
	if err != nil {
		// Fall back to LIKE if the FTS5 query itself is malformed
		return r.searchLike(query)
	}
	defer rows.Close()

	refs, err := r.scanReferences(rows)
	if err != nil {
		return nil, err
	}

	for i := range refs {
		tags, err := r.GetTagsForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Tags = tags

		folders, err := r.GetFoldersForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Folders = folders

		links, err := r.GetLinksForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Links = links
	}

	return refs, nil
}

// searchLike is the fallback search used when FTS5 fails (e.g. malformed query string).
func (r *Repository) searchLike(query string) ([]models.Reference, error) {
	sqlQuery := `
		SELECT id, entry_type, cite_key, title, authors, year, venue,
			volume, number, pages, doi, url, abstract, keywords, notes,
			raw_bibtex, COALESCE(github_url, ''), created_at, updated_at, imported_at
		FROM refs
		WHERE title LIKE ? OR authors LIKE ? OR cite_key LIKE ? OR venue LIKE ?
		ORDER BY created_at DESC
	`
	searchTerm := "%" + query + "%"
	rows, err := r.db.Conn().Query(sqlQuery, searchTerm, searchTerm, searchTerm, searchTerm)
	if err != nil {
		return nil, fmt.Errorf("failed to search references: %w", err)
	}
	defer rows.Close()

	refs, err := r.scanReferences(rows)
	if err != nil {
		return nil, err
	}

	for i := range refs {
		tags, err := r.GetTagsForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Tags = tags

		folders, err := r.GetFoldersForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Folders = folders

		links, err := r.GetLinksForReference(refs[i].ID)
		if err != nil {
			return nil, err
		}
		refs[i].Links = links
	}

	return refs, nil
}

func (r *Repository) CiteKeyExists(citeKey string, excludeID string) (bool, error) {
	query := `SELECT COUNT(*) FROM refs WHERE cite_key = ? AND id != ?`
	var count int
	err := r.db.Conn().QueryRow(query, citeKey, excludeID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *Repository) scanReferences(rows *sql.Rows) ([]models.Reference, error) {
	var refs []models.Reference
	for rows.Next() {
		ref := models.Reference{}
		var citeKey, authors, venue, volume, number, pages, doi, url, abstract, keywords, notes, rawBibtex, githubURL sql.NullString
		var year sql.NullInt64
		var importedAt sql.NullTime

		err := rows.Scan(
			&ref.ID, &ref.EntryType, &citeKey, &ref.Title, &authors,
			&year, &venue, &volume, &number, &pages, &doi, &url,
			&abstract, &keywords, &notes, &rawBibtex, &githubURL, &ref.CreatedAt, &ref.UpdatedAt, &importedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reference: %w", err)
		}

		ref.CiteKey = citeKey.String
		ref.Authors = authors.String
		ref.Year = int(year.Int64)
		ref.Venue = venue.String
		ref.Volume = volume.String
		ref.Number = number.String
		ref.Pages = pages.String
		ref.DOI = doi.String
		ref.URL = url.String
		ref.Abstract = abstract.String
		ref.Keywords = keywords.String
		ref.Notes = notes.String
		ref.RawBibtex = rawBibtex.String
		ref.GitHubURL = githubURL.String
		if importedAt.Valid {
			ref.ImportedAt = &importedAt.Time
		}
		ref.Tags = []models.Tag{}
		ref.Folders = []models.Folder{}
		ref.Links = []models.ReferenceLink{}

		refs = append(refs, ref)
	}

	if refs == nil {
		refs = []models.Reference{}
	}

	return refs, nil
}
