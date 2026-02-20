package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"antonelli/app/models"

	"github.com/google/uuid"
)

var tagColors = []string{
	"#ef4444", // red
	"#f97316", // orange
	"#eab308", // yellow
	"#22c55e", // green
	"#14b8a6", // teal
	"#3b82f6", // blue
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#6b7280", // gray
	"#06b6d4", // cyan
}

func hashString(s string) int {
	h := 0
	for _, c := range s {
		h = 31*h + int(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}

func (r *Repository) GetOrCreateTag(name string) (*models.Tag, error) {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return nil, fmt.Errorf("tag name cannot be empty")
	}

	var tag models.Tag
	var color sql.NullString
	err := r.db.Conn().QueryRow(
		"SELECT id, name, color, created_at FROM tags WHERE name = ?",
		name,
	).Scan(&tag.ID, &tag.Name, &color, &tag.CreatedAt)

	if err == nil {
		tag.Color = color.String
		return &tag, nil
	}

	id := uuid.New().String()
	now := time.Now()
	tagColor := tagColors[hashString(name)%len(tagColors)]

	_, err = r.db.Conn().Exec(
		"INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
		id, name, tagColor, now,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}

	return &models.Tag{
		ID:        id,
		Name:      name,
		Color:     tagColor,
		CreatedAt: now,
	}, nil
}

func (r *Repository) GetAllTags() ([]models.Tag, error) {
	query := `
		SELECT t.id, t.name, t.color, t.created_at
		FROM tags t
		ORDER BY t.name ASC
	`

	rows, err := r.db.Conn().Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		var color sql.NullString
		if err := rows.Scan(&tag.ID, &tag.Name, &color, &tag.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tag.Color = color.String
		tags = append(tags, tag)
	}

	if tags == nil {
		tags = []models.Tag{}
	}

	return tags, nil
}

func (r *Repository) GetTagsForReference(refID string) ([]models.Tag, error) {
	query := `
		SELECT t.id, t.name, t.color, t.created_at
		FROM tags t
		JOIN reference_tags rt ON t.id = rt.tag_id
		WHERE rt.reference_id = ?
		ORDER BY t.name ASC
	`

	rows, err := r.db.Conn().Query(query, refID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tags for reference: %w", err)
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		var color sql.NullString
		if err := rows.Scan(&tag.ID, &tag.Name, &color, &tag.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tag.Color = color.String
		tags = append(tags, tag)
	}

	if tags == nil {
		tags = []models.Tag{}
	}

	return tags, nil
}

func (r *Repository) SetReferenceTags(refID string, tagNames []string) error {
	_, err := r.db.Conn().Exec("DELETE FROM reference_tags WHERE reference_id = ?", refID)
	if err != nil {
		return fmt.Errorf("failed to clear existing tags: %w", err)
	}

	for _, name := range tagNames {
		name = strings.ToLower(strings.TrimSpace(name))
		if name == "" {
			continue
		}

		tag, err := r.GetOrCreateTag(name)
		if err != nil {
			return fmt.Errorf("failed to get or create tag: %w", err)
		}

		_, err = r.db.Conn().Exec(
			"INSERT OR IGNORE INTO reference_tags (reference_id, tag_id) VALUES (?, ?)",
			refID, tag.ID,
		)
		if err != nil {
			return fmt.Errorf("failed to associate tag: %w", err)
		}
	}

	return nil
}

func (r *Repository) GetReferencesByTag(tagName string) ([]models.Reference, error) {
	tagName = strings.ToLower(strings.TrimSpace(tagName))

	query := `
		SELECT r.id, r.entry_type, r.cite_key, r.title, r.authors, r.year, r.venue,
			r.volume, r.number, r.pages, r.doi, r.url, r.abstract, r.keywords, r.notes,
			r.raw_bibtex, COALESCE(r.github_url, ''), r.created_at, r.updated_at
		FROM refs r
		JOIN reference_tags rt ON r.id = rt.reference_id
		JOIN tags t ON rt.tag_id = t.id
		WHERE t.name = ?
		ORDER BY r.created_at DESC
	`

	rows, err := r.db.Conn().Query(query, tagName)
	if err != nil {
		return nil, fmt.Errorf("failed to get references by tag: %w", err)
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

func (r *Repository) DeleteUnusedTags() error {
	_, err := r.db.Conn().Exec(`
		DELETE FROM tags
		WHERE id NOT IN (SELECT DISTINCT tag_id FROM reference_tags)
	`)
	if err != nil {
		return fmt.Errorf("failed to delete unused tags: %w", err)
	}
	return nil
}
