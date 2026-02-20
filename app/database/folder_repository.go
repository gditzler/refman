package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"antonelli/app/models"

	"github.com/google/uuid"
)

func (r *Repository) CreateFolder(name string) (*models.Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("folder name cannot be empty")
	}

	// Check if folder with name already exists
	var existing models.Folder
	err := r.db.Conn().QueryRow(
		"SELECT id, name, created_at FROM folders WHERE name = ?",
		name,
	).Scan(&existing.ID, &existing.Name, &existing.CreatedAt)
	if err == nil {
		return nil, fmt.Errorf("folder with name %q already exists", name)
	}
	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check folder: %w", err)
	}

	id := uuid.New().String()
	now := time.Now()

	_, err = r.db.Conn().Exec(
		"INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)",
		id, name, now,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return &models.Folder{
		ID:        id,
		Name:      name,
		CreatedAt: now,
	}, nil
}

func (r *Repository) GetOrCreateFolder(name string) (*models.Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("folder name cannot be empty")
	}

	var folder models.Folder
	err := r.db.Conn().QueryRow(
		"SELECT id, name, created_at FROM folders WHERE name = ?",
		name,
	).Scan(&folder.ID, &folder.Name, &folder.CreatedAt)
	if err == nil {
		return &folder, nil
	}
	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get folder: %w", err)
	}

	return r.CreateFolder(name)
}

func (r *Repository) GetAllFolders() ([]models.Folder, error) {
	query := `
		SELECT id, name, created_at
		FROM folders
		ORDER BY name ASC
	`

	rows, err := r.db.Conn().Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get folders: %w", err)
	}
	defer rows.Close()

	var folders []models.Folder
	for rows.Next() {
		var folder models.Folder
		if err := rows.Scan(&folder.ID, &folder.Name, &folder.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan folder: %w", err)
		}
		folders = append(folders, folder)
	}

	if folders == nil {
		folders = []models.Folder{}
	}

	return folders, nil
}

func (r *Repository) GetFolderByID(id string) (*models.Folder, error) {
	var folder models.Folder
	err := r.db.Conn().QueryRow(
		"SELECT id, name, created_at FROM folders WHERE id = ?",
		id,
	).Scan(&folder.ID, &folder.Name, &folder.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("folder not found: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get folder: %w", err)
	}
	return &folder, nil
}

func (r *Repository) DeleteFolder(id string) error {
	result, err := r.db.Conn().Exec("DELETE FROM folders WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete folder: %w", err)
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("folder not found: %s", id)
	}
	return nil
}

func (r *Repository) GetFoldersForReference(refID string) ([]models.Folder, error) {
	query := `
		SELECT f.id, f.name, f.created_at
		FROM folders f
		JOIN reference_folders rf ON f.id = rf.folder_id
		WHERE rf.reference_id = ?
		ORDER BY f.name ASC
	`

	rows, err := r.db.Conn().Query(query, refID)
	if err != nil {
		return nil, fmt.Errorf("failed to get folders for reference: %w", err)
	}
	defer rows.Close()

	var folders []models.Folder
	for rows.Next() {
		var folder models.Folder
		if err := rows.Scan(&folder.ID, &folder.Name, &folder.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan folder: %w", err)
		}
		folders = append(folders, folder)
	}

	if folders == nil {
		folders = []models.Folder{}
	}

	return folders, nil
}

func (r *Repository) SetReferenceFolders(refID string, folderNames []string) error {
	_, err := r.db.Conn().Exec("DELETE FROM reference_folders WHERE reference_id = ?", refID)
	if err != nil {
		return fmt.Errorf("failed to clear existing folders: %w", err)
	}

	for _, name := range folderNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		folder, err := r.GetOrCreateFolder(name)
		if err != nil {
			return fmt.Errorf("failed to get or create folder: %w", err)
		}

		_, err = r.db.Conn().Exec(
			"INSERT OR IGNORE INTO reference_folders (reference_id, folder_id) VALUES (?, ?)",
			refID, folder.ID,
		)
		if err != nil {
			return fmt.Errorf("failed to associate folder: %w", err)
		}
	}

	return nil
}

// AddReferencesToFolder adds the given references to a folder without removing them from other folders.
func (r *Repository) AddReferencesToFolder(refIDs []string, folderID string) error {
	if _, err := r.GetFolderByID(folderID); err != nil {
		return fmt.Errorf("folder not found: %w", err)
	}

	for _, refID := range refIDs {
		if refID == "" {
			continue
		}
		_, err := r.db.Conn().Exec(
			"INSERT OR IGNORE INTO reference_folders (reference_id, folder_id) VALUES (?, ?)",
			refID, folderID,
		)
		if err != nil {
			return fmt.Errorf("failed to add reference to folder: %w", err)
		}
	}
	return nil
}

func (r *Repository) GetReferencesByFolder(folderID string) ([]models.Reference, error) {
	query := `
		SELECT r.id, r.entry_type, r.cite_key, r.title, r.authors, r.year, r.venue,
			r.volume, r.number, r.pages, r.doi, r.url, r.abstract, r.keywords, r.notes,
			r.raw_bibtex, COALESCE(r.github_url, ''), r.created_at, r.updated_at
		FROM refs r
		JOIN reference_folders rf ON r.id = rf.reference_id
		WHERE rf.folder_id = ?
		ORDER BY r.created_at DESC
	`

	rows, err := r.db.Conn().Query(query, folderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get references by folder: %w", err)
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
