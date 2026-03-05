package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	conn          *sql.DB
	fts5Available bool
}

// FTS5Available reports whether the database was initialized with FTS5 support.
// When false, Search falls back to LIKE queries.
func (db *DB) FTS5Available() bool {
	return db.fts5Available
}

func NewDB() (*DB, error) {
	dbPath, err := getDBPath()
	if err != nil {
		return nil, fmt.Errorf("failed to get database path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	conn, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for concurrent reads during writes (prevents UI freezes on bulk import)
	if _, err := conn.Exec("PRAGMA journal_mode=WAL"); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}
	// NORMAL sync is safe with WAL and much faster than FULL
	if _, err := conn.Exec("PRAGMA synchronous=NORMAL"); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to set synchronous mode: %w", err)
	}

	db := &DB{conn: conn}

	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

func (db *DB) Conn() *sql.DB {
	return db.conn
}

func getDBPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	appSupportDir := filepath.Join(homeDir, "Library", "Application Support", "antonelli")
	return filepath.Join(appSupportDir, "antonelli.db"), nil
}

func (db *DB) migrate() error {
	// Required migrations — must all succeed for the app to function.
	required := []string{
		`CREATE TABLE IF NOT EXISTS refs (
			id TEXT PRIMARY KEY,
			entry_type TEXT NOT NULL,
			cite_key TEXT UNIQUE,
			title TEXT NOT NULL,
			authors TEXT,
			year INTEGER,
			venue TEXT,
			volume TEXT,
			number TEXT,
			pages TEXT,
			doi TEXT,
			url TEXT,
			abstract TEXT,
			keywords TEXT,
			notes TEXT,
			raw_bibtex TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refs_cite_key ON refs(cite_key)`,
		`CREATE INDEX IF NOT EXISTS idx_refs_year ON refs(year)`,
		`CREATE INDEX IF NOT EXISTS idx_refs_entry_type ON refs(entry_type)`,
		`CREATE TABLE IF NOT EXISTS tags (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS reference_tags (
			reference_id TEXT NOT NULL,
			tag_id TEXT NOT NULL,
			PRIMARY KEY (reference_id, tag_id),
			FOREIGN KEY (reference_id) REFERENCES refs(id) ON DELETE CASCADE,
			FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_reference_tags_ref ON reference_tags(reference_id)`,
		`CREATE INDEX IF NOT EXISTS idx_reference_tags_tag ON reference_tags(tag_id)`,
		`CREATE TABLE IF NOT EXISTS folders (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS reference_folders (
			reference_id TEXT NOT NULL,
			folder_id TEXT NOT NULL,
			PRIMARY KEY (reference_id, folder_id),
			FOREIGN KEY (reference_id) REFERENCES refs(id) ON DELETE CASCADE,
			FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_reference_folders_ref ON reference_folders(reference_id)`,
		`CREATE INDEX IF NOT EXISTS idx_reference_folders_folder ON reference_folders(folder_id)`,
		`CREATE TABLE IF NOT EXISTS reference_links (
			id TEXT PRIMARY KEY,
			reference_id TEXT NOT NULL,
			label TEXT NOT NULL,
			url TEXT NOT NULL,
			FOREIGN KEY (reference_id) REFERENCES refs(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_reference_links_ref ON reference_links(reference_id)`,
		// schema_flags: tracks one-time migrations (avoids re-running expensive ops on startup)
		`CREATE TABLE IF NOT EXISTS schema_flags (key TEXT PRIMARY KEY, value TEXT)`,
		`CREATE TABLE IF NOT EXISTS ref_embeddings (
    ref_id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    embedding TEXT NOT NULL,
    embedded_at DATETIME NOT NULL,
    FOREIGN KEY (ref_id) REFERENCES refs(id) ON DELETE CASCADE
)`,
	}

	for _, m := range required {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	// Additive column migrations (idempotent)
	if err := db.addColumnIfNotExists("tags", "color", "TEXT DEFAULT ''"); err != nil {
		return fmt.Errorf("add column tags.color: %w", err)
	}
	if err := db.addColumnIfNotExists("refs", "github_url", "TEXT DEFAULT ''"); err != nil {
		return fmt.Errorf("add column refs.github_url: %w", err)
	}
	if err := db.addColumnIfNotExists("refs", "imported_at", "DATETIME"); err != nil {
		return fmt.Errorf("add column refs.imported_at: %w", err)
	}

	// Optional: FTS5 full-text search.
	// go-sqlite3 requires the `sqlite_fts5` build tag to include FTS5.
	// If FTS5 is not compiled in, we degrade gracefully to LIKE search.
	if err := db.setupFTS5(); err != nil {
		// Non-fatal: app works fine, just with slower LIKE-based search.
		db.fts5Available = false
	} else {
		db.fts5Available = true
	}

	return nil
}

// setupFTS5 creates the FTS5 virtual table, sync triggers, and populates the
// index from existing rows (once). Returns an error if FTS5 is not compiled in.
func (db *DB) setupFTS5() error {
	fts5Migrations := []string{
		`CREATE VIRTUAL TABLE IF NOT EXISTS refs_fts USING fts5(
			id UNINDEXED,
			title,
			authors,
			cite_key,
			venue,
			abstract,
			keywords,
			notes,
			content=refs,
			content_rowid=rowid
		)`,
		// Keep FTS in sync with refs: insert
		`CREATE TRIGGER IF NOT EXISTS refs_fts_insert AFTER INSERT ON refs BEGIN
			INSERT INTO refs_fts(rowid, id, title, authors, cite_key, venue, abstract, keywords, notes)
			VALUES (new.rowid, new.id, new.title, new.authors, new.cite_key, new.venue, new.abstract, new.keywords, new.notes);
		END`,
		// Keep FTS in sync with refs: delete
		`CREATE TRIGGER IF NOT EXISTS refs_fts_delete AFTER DELETE ON refs BEGIN
			INSERT INTO refs_fts(refs_fts, rowid, id, title, authors, cite_key, venue, abstract, keywords, notes)
			VALUES ('delete', old.rowid, old.id, old.title, old.authors, old.cite_key, old.venue, old.abstract, old.keywords, old.notes);
		END`,
		// Keep FTS in sync with refs: update
		`CREATE TRIGGER IF NOT EXISTS refs_fts_update AFTER UPDATE ON refs BEGIN
			INSERT INTO refs_fts(refs_fts, rowid, id, title, authors, cite_key, venue, abstract, keywords, notes)
			VALUES ('delete', old.rowid, old.id, old.title, old.authors, old.cite_key, old.venue, old.abstract, old.keywords, old.notes);
			INSERT INTO refs_fts(rowid, id, title, authors, cite_key, venue, abstract, keywords, notes)
			VALUES (new.rowid, new.id, new.title, new.authors, new.cite_key, new.venue, new.abstract, new.keywords, new.notes);
		END`,
	}

	for _, m := range fts5Migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return err
		}
	}

	// Rebuild the FTS index once to catch any rows that existed before FTS was set up.
	return db.runOnce("fts_initialized", func() error {
		_, err := db.conn.Exec("INSERT INTO refs_fts(refs_fts) VALUES('rebuild')")
		return err
	})
}

// runOnce executes fn exactly once, tracked by key in schema_flags.
func (db *DB) runOnce(key string, fn func() error) error {
	var existing string
	err := db.conn.QueryRow("SELECT value FROM schema_flags WHERE key = ?", key).Scan(&existing)
	if err == nil {
		return nil // already run
	}
	if err := fn(); err != nil {
		return err
	}
	_, err = db.conn.Exec("INSERT OR REPLACE INTO schema_flags (key, value) VALUES (?, 'done')", key)
	return err
}

func (db *DB) addColumnIfNotExists(table, column, columnDef string) error {
	query := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, columnDef)
	_, err := db.conn.Exec(query)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}
	return nil
}
