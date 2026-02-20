package database

import (
	"fmt"
	"strings"

	"antonelli/app/models"

	"github.com/google/uuid"
)

func (r *Repository) GetLinksForReference(refID string) ([]models.ReferenceLink, error) {
	query := `
		SELECT id, reference_id, label, url
		FROM reference_links
		WHERE reference_id = ?
		ORDER BY label ASC
	`

	rows, err := r.db.Conn().Query(query, refID)
	if err != nil {
		return nil, fmt.Errorf("failed to get links for reference: %w", err)
	}
	defer rows.Close()

	var links []models.ReferenceLink
	for rows.Next() {
		var link models.ReferenceLink
		if err := rows.Scan(&link.ID, &link.ReferenceID, &link.Label, &link.URL); err != nil {
			return nil, fmt.Errorf("failed to scan link: %w", err)
		}
		links = append(links, link)
	}

	if links == nil {
		links = []models.ReferenceLink{}
	}

	return links, nil
}

func (r *Repository) SetReferenceLinks(refID string, links []models.LinkInput) error {
	_, err := r.db.Conn().Exec("DELETE FROM reference_links WHERE reference_id = ?", refID)
	if err != nil {
		return fmt.Errorf("failed to clear existing links: %w", err)
	}

	for _, input := range links {
		input.Label = strings.TrimSpace(input.Label)
		input.URL = strings.TrimSpace(input.URL)
		if input.Label == "" || input.URL == "" {
			continue
		}

		id := uuid.New().String()
		_, err = r.db.Conn().Exec(
			"INSERT INTO reference_links (id, reference_id, label, url) VALUES (?, ?, ?, ?)",
			id, refID, input.Label, input.URL,
		)
		if err != nil {
			return fmt.Errorf("failed to insert link: %w", err)
		}
	}

	return nil
}
