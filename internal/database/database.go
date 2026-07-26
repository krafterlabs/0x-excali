package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)
// DB wraps the sql.DB connection and provides domain-specific query methods.
type DB struct {
	conn   *sql.DB
	dbPath string
}

// --- Initialization ---

// New opens or creates the SQLite database at the platform-appropriate config directory
// and runs all migrations. Returns a ready-to-use DB handle.
func New() (*DB, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user config dir: %w", err)
	}

	appDir := filepath.Join(configDir, "0x-excali")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create app config dir: %w", err)
	}

	dbPath := filepath.Join(appDir, "0x-excali.db")
	conn, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings for a single-user desktop app
	conn.SetMaxOpenConns(1)
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(0) // keep alive forever

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{conn: conn, dbPath: dbPath}
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// Close gracefully shuts down the database connection.
func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

// migrate runs all DDL statements to create or update the schema.
func (db *DB) migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS auth (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			github_id   INTEGER UNIQUE NOT NULL,
			username    TEXT NOT NULL,
			avatar_url  TEXT DEFAULT '',
			email       TEXT DEFAULT '',
			token_enc   BLOB NOT NULL,
			token_nonce BLOB NOT NULL,
			scopes      TEXT DEFAULT '',
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS workspace (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			repo_id        INTEGER UNIQUE NOT NULL,
			owner          TEXT NOT NULL,
			name           TEXT NOT NULL,
			full_name      TEXT NOT NULL,
			default_branch TEXT DEFAULT 'main',
			is_private     INTEGER DEFAULT 0,
			is_active      INTEGER DEFAULT 1,
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS file_tree (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			workspace_id INTEGER NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
			path         TEXT NOT NULL,
			name         TEXT NOT NULL,
			type         TEXT NOT NULL CHECK(type IN ('file', 'folder')),
			sha          TEXT DEFAULT '',
			content      TEXT DEFAULT '',
			parent_path  TEXT DEFAULT '',
			size_bytes   INTEGER DEFAULT 0,
			created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
			synced_at    DATETIME,
			is_dirty     INTEGER DEFAULT 0,
			UNIQUE(workspace_id, path)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			key        TEXT UNIQUE NOT NULL,
			value      TEXT NOT NULL,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sync_queue (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			workspace_id INTEGER NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
			operation    TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
			file_path    TEXT NOT NULL,
			payload      TEXT DEFAULT '',
			status       TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
			retry_count  INTEGER DEFAULT 0,
			error_msg    TEXT DEFAULT '',
			created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
			processed_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_file_tree_workspace ON file_tree(workspace_id)`,
		`CREATE INDEX IF NOT EXISTS idx_file_tree_parent ON file_tree(workspace_id, parent_path)`,
		`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
	}

	for _, ddl := range migrations {
		if _, err := db.conn.ExecContext(context.Background(), ddl); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, ddl)
		}
	}
	return nil
}

// --- Helpers ---

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func nullableTime(t string) interface{} {
	if t == "" {
		return nil
	}
	return t
}
