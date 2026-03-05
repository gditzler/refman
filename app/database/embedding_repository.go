package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// StoredEmbedding holds a cached embedding for a reference.
type StoredEmbedding struct {
	RefID      string
	Model      string
	Embedding  []float64
	EmbeddedAt time.Time
}

// UpsertEmbedding stores or replaces the embedding for a reference.
func (r *Repository) UpsertEmbedding(refID, model string, embedding []float64) error {
	data, err := json.Marshal(embedding)
	if err != nil {
		return fmt.Errorf("marshal embedding: %w", err)
	}
	_, err = r.db.Conn().Exec(
		`INSERT OR REPLACE INTO ref_embeddings (ref_id, model, embedding, embedded_at) VALUES (?, ?, ?, ?)`,
		refID, model, string(data), time.Now(),
	)
	return err
}

// GetEmbedding retrieves the stored embedding for a reference, or returns nil if not found.
func (r *Repository) GetEmbedding(refID string) (*StoredEmbedding, error) {
	row := r.db.Conn().QueryRow(
		`SELECT ref_id, model, embedding, embedded_at FROM ref_embeddings WHERE ref_id = ?`, refID,
	)
	var e StoredEmbedding
	var embJSON string
	err := row.Scan(&e.RefID, &e.Model, &embJSON, &e.EmbeddedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get embedding: %w", err)
	}
	if err := json.Unmarshal([]byte(embJSON), &e.Embedding); err != nil {
		return nil, fmt.Errorf("unmarshal embedding: %w", err)
	}
	return &e, nil
}

// GetAllEmbeddings returns all stored embeddings as a map from ref_id to StoredEmbedding.
func (r *Repository) GetAllEmbeddings() (map[string]*StoredEmbedding, error) {
	rows, err := r.db.Conn().Query(
		`SELECT ref_id, model, embedding, embedded_at FROM ref_embeddings`,
	)
	if err != nil {
		return nil, fmt.Errorf("get all embeddings: %w", err)
	}
	defer rows.Close()

	result := make(map[string]*StoredEmbedding)
	for rows.Next() {
		var e StoredEmbedding
		var embJSON string
		if err := rows.Scan(&e.RefID, &e.Model, &embJSON, &e.EmbeddedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(embJSON), &e.Embedding); err != nil {
			return nil, err
		}
		result[e.RefID] = &e
	}
	return result, nil
}

// DeleteEmbedding removes the stored embedding for a reference (e.g., when ref is updated).
func (r *Repository) DeleteEmbedding(refID string) error {
	_, err := r.db.Conn().Exec(`DELETE FROM ref_embeddings WHERE ref_id = ?`, refID)
	return err
}
