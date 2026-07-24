package database

import (
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

// --- Domain Types ---

// AuthRecord represents a stored GitHub authentication.
type AuthRecord struct {
	ID         int64  `json:"id"`
	GitHubID   int64  `json:"github_id"`
	Username   string `json:"username"`
	AvatarURL  string `json:"avatar_url"`
	Email      string `json:"email"`
	TokenEnc   []byte `json:"-"`
	TokenNonce []byte `json:"-"`
	Scopes     string `json:"scopes"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// Workspace represents a selected GitHub repository workspace.
type Workspace struct {
	ID            int64  `json:"id"`
	RepoID        int64  `json:"repo_id"`
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
	IsPrivate     bool   `json:"is_private"`
	IsActive      bool   `json:"is_active"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// FileNode represents a file or folder in the local cache.
type FileNode struct {
	ID          int64  `json:"id"`
	WorkspaceID int64  `json:"workspace_id"`
	Path        string `json:"path"`
	Name        string `json:"name"`
	Type        string `json:"type"` // "file" or "folder"
	SHA         string `json:"sha"`
	Content     string `json:"content,omitempty"`
	ParentPath  string `json:"parent_path"`
	SizeBytes   int64  `json:"size_bytes"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	SyncedAt    string `json:"synced_at"`
	IsDirty     bool   `json:"is_dirty"`
}

// SyncQueueItem represents a pending sync operation.
type SyncQueueItem struct {
	ID          int64  `json:"id"`
	WorkspaceID int64  `json:"workspace_id"`
	Operation   string `json:"operation"` // "create", "update", "delete"
	FilePath    string `json:"file_path"`
	Payload     string `json:"payload"`
	Status      string `json:"status"` // "pending", "in_progress", "completed", "failed"
	RetryCount  int    `json:"retry_count"`
	ErrorMsg    string `json:"error_msg"`
	CreatedAt   string `json:"created_at"`
	ProcessedAt string `json:"processed_at"`
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
		if _, err := db.conn.Exec(ddl); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, ddl)
		}
	}
	return nil
}

// --- Auth CRUD ---

// UpsertAuth inserts or updates the authentication record.
func (db *DB) UpsertAuth(record *AuthRecord) error {
	_, err := db.conn.Exec(`
		INSERT INTO auth (github_id, username, avatar_url, email, token_enc, token_nonce, scopes, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(github_id) DO UPDATE SET
			username = excluded.username,
			avatar_url = excluded.avatar_url,
			email = excluded.email,
			token_enc = excluded.token_enc,
			token_nonce = excluded.token_nonce,
			scopes = excluded.scopes,
			updated_at = CURRENT_TIMESTAMP
	`, record.GitHubID, record.Username, record.AvatarURL, record.Email,
		record.TokenEnc, record.TokenNonce, record.Scopes)
	return err
}

// GetAuth retrieves the first (and only) auth record, or nil if none exists.
func (db *DB) GetAuth() (*AuthRecord, error) {
	row := db.conn.QueryRow(`SELECT id, github_id, username, avatar_url, email, token_enc, token_nonce, scopes, created_at, updated_at FROM auth LIMIT 1`)

	var rec AuthRecord
	err := row.Scan(&rec.ID, &rec.GitHubID, &rec.Username, &rec.AvatarURL, &rec.Email,
		&rec.TokenEnc, &rec.TokenNonce, &rec.Scopes, &rec.CreatedAt, &rec.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// DeleteAuth removes all auth records (logout).
func (db *DB) DeleteAuth() error {
	_, err := db.conn.Exec(`DELETE FROM auth`)
	return err
}

// --- Workspace CRUD ---

// UpsertWorkspace inserts or updates a workspace. Deactivates all others first.
func (db *DB) UpsertWorkspace(ws *Workspace) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Deactivate all existing workspaces
	if _, err := tx.Exec(`UPDATE workspace SET is_active = 0`); err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO workspace (repo_id, owner, name, full_name, default_branch, is_private, is_active, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
		ON CONFLICT(repo_id) DO UPDATE SET
			owner = excluded.owner,
			name = excluded.name,
			full_name = excluded.full_name,
			default_branch = excluded.default_branch,
			is_private = excluded.is_private,
			is_active = 1,
			updated_at = CURRENT_TIMESTAMP
	`, ws.RepoID, ws.Owner, ws.Name, ws.FullName, ws.DefaultBranch, boolToInt(ws.IsPrivate))
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetActiveWorkspace returns the currently active workspace, or nil.
func (db *DB) GetActiveWorkspace() (*Workspace, error) {
	row := db.conn.QueryRow(`
		SELECT id, repo_id, owner, name, full_name, default_branch, is_private, is_active, created_at, updated_at
		FROM workspace WHERE is_active = 1 LIMIT 1
	`)

	var ws Workspace
	var isPrivateInt, isActiveInt int
	err := row.Scan(&ws.ID, &ws.RepoID, &ws.Owner, &ws.Name, &ws.FullName,
		&ws.DefaultBranch, &isPrivateInt, &isActiveInt, &ws.CreatedAt, &ws.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ws.IsPrivate = isPrivateInt == 1
	ws.IsActive = isActiveInt == 1
	return &ws, nil
}

// --- File Tree CRUD ---

// UpsertFileNode inserts or updates a file tree node.
func (db *DB) UpsertFileNode(node *FileNode) error {
	_, err := db.conn.Exec(`
		INSERT INTO file_tree (workspace_id, path, name, type, sha, content, parent_path, size_bytes, updated_at, synced_at, is_dirty)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
		ON CONFLICT(workspace_id, path) DO UPDATE SET
			name = excluded.name,
			sha = excluded.sha,
			content = excluded.content,
			parent_path = excluded.parent_path,
			size_bytes = excluded.size_bytes,
			updated_at = CURRENT_TIMESTAMP,
			synced_at = excluded.synced_at,
			is_dirty = excluded.is_dirty
	`, node.WorkspaceID, node.Path, node.Name, node.Type, node.SHA,
		node.Content, node.ParentPath, node.SizeBytes, nullableTime(node.SyncedAt), boolToInt(node.IsDirty))
	return err
}

// GetFolderContents returns all direct children of the given parent path.
func (db *DB) GetFolderContents(workspaceID int64, parentPath string) ([]FileNode, error) {
	rows, err := db.conn.Query(`
		SELECT id, workspace_id, path, name, type, sha, parent_path, size_bytes, created_at, updated_at, COALESCE(synced_at, ''), is_dirty
		FROM file_tree
		WHERE workspace_id = ? AND parent_path = ?
		ORDER BY type DESC, name ASC
	`, workspaceID, parentPath)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []FileNode
	for rows.Next() {
		var n FileNode
		var isDirtyInt int
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &n.Path, &n.Name, &n.Type, &n.SHA,
			&n.ParentPath, &n.SizeBytes, &n.CreatedAt, &n.UpdatedAt, &n.SyncedAt, &isDirtyInt); err != nil {
			return nil, err
		}
		n.IsDirty = isDirtyInt == 1
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// GetFileByPath retrieves a single file node by its path within a workspace.
func (db *DB) GetFileByPath(workspaceID int64, path string) (*FileNode, error) {
	row := db.conn.QueryRow(`
		SELECT id, workspace_id, path, name, type, sha, content, parent_path, size_bytes,
			   created_at, updated_at, COALESCE(synced_at, ''), is_dirty
		FROM file_tree
		WHERE workspace_id = ? AND path = ?
	`, workspaceID, path)

	var n FileNode
	var isDirtyInt int
	err := row.Scan(&n.ID, &n.WorkspaceID, &n.Path, &n.Name, &n.Type, &n.SHA, &n.Content,
		&n.ParentPath, &n.SizeBytes, &n.CreatedAt, &n.UpdatedAt, &n.SyncedAt, &isDirtyInt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	n.IsDirty = isDirtyInt == 1
	return &n, nil
}

// UpdateFileContent updates the content of a file and marks it dirty.
func (db *DB) UpdateFileContent(workspaceID int64, path, content, sha string) error {
	_, err := db.conn.Exec(`
		UPDATE file_tree SET content = ?, sha = ?, is_dirty = 1, updated_at = CURRENT_TIMESTAMP
		WHERE workspace_id = ? AND path = ?
	`, content, sha, workspaceID, path)
	return err
}

// MarkFileSynced clears the dirty flag and updates synced_at.
func (db *DB) MarkFileSynced(workspaceID int64, path, newSHA string) error {
	_, err := db.conn.Exec(`
		UPDATE file_tree SET is_dirty = 0, sha = ?, synced_at = CURRENT_TIMESTAMP
		WHERE workspace_id = ? AND path = ?
	`, newSHA, workspaceID, path)
	return err
}

// DeleteFileNode removes a file tree node and all its children (if folder).
func (db *DB) DeleteFileNode(workspaceID int64, path string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete children first (for folders)
	if _, err := tx.Exec(`DELETE FROM file_tree WHERE workspace_id = ? AND (path = ? OR path LIKE ?)`,
		workspaceID, path, path+"/%"); err != nil {
		return err
	}

	return tx.Commit()
}

// ClearFileTree removes all file tree nodes for a workspace (used before full re-sync).
func (db *DB) ClearFileTree(workspaceID int64) error {
	_, err := db.conn.Exec(`DELETE FROM file_tree WHERE workspace_id = ? AND is_dirty = 0`, workspaceID)
	return err
}

// GetDirtyFiles returns all files marked as dirty for a workspace.
func (db *DB) GetDirtyFiles(workspaceID int64) ([]FileNode, error) {
	rows, err := db.conn.Query(`
		SELECT id, workspace_id, path, name, type, sha, content, parent_path, size_bytes,
			   created_at, updated_at, COALESCE(synced_at, ''), is_dirty
		FROM file_tree
		WHERE workspace_id = ? AND is_dirty = 1
		ORDER BY path ASC
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []FileNode
	for rows.Next() {
		var n FileNode
		var isDirtyInt int
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &n.Path, &n.Name, &n.Type, &n.SHA, &n.Content,
			&n.ParentPath, &n.SizeBytes, &n.CreatedAt, &n.UpdatedAt, &n.SyncedAt, &isDirtyInt); err != nil {
			return nil, err
		}
		n.IsDirty = isDirtyInt == 1
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// GetFilesUnder returns all file nodes (folders excluded) at or under the given
// path. Used when deleting a folder: GitHub has no folder objects, so removing a
// folder means deleting every file inside it. Only path and SHA are populated.
func (db *DB) GetFilesUnder(workspaceID int64, path string) ([]FileNode, error) {
	rows, err := db.conn.Query(`
		SELECT path, sha FROM file_tree
		WHERE workspace_id = ? AND type = 'file' AND (path = ? OR path LIKE ?)
	`, workspaceID, path, path+"/%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []FileNode
	for rows.Next() {
		var n FileNode
		if err := rows.Scan(&n.Path, &n.SHA); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// --- Settings CRUD ---

// GetSetting retrieves a single setting by key, or empty string if not found.
func (db *DB) GetSetting(key string) (string, error) {
	var value string
	err := db.conn.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// SetSetting inserts or updates a setting.
func (db *DB) SetSetting(key, value string) error {
	_, err := db.conn.Exec(`
		INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = CURRENT_TIMESTAMP
	`, key, value)
	return err
}

// --- Sync Queue CRUD ---

// EnqueueSync adds an operation to the sync queue.
func (db *DB) EnqueueSync(workspaceID int64, operation, filePath, payload string) error {
	_, err := db.conn.Exec(`
		INSERT INTO sync_queue (workspace_id, operation, file_path, payload)
		VALUES (?, ?, ?, ?)
	`, workspaceID, operation, filePath, payload)
	return err
}

// GetPendingSyncItems returns all pending sync operations, oldest first.
func (db *DB) GetPendingSyncItems(limit int) ([]SyncQueueItem, error) {
	rows, err := db.conn.Query(`
		SELECT id, workspace_id, operation, file_path, payload, status, retry_count, error_msg, created_at, COALESCE(processed_at, '')
		FROM sync_queue
		WHERE status IN ('pending', 'failed') AND retry_count < 3
		ORDER BY created_at ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SyncQueueItem
	for rows.Next() {
		var item SyncQueueItem
		if err := rows.Scan(&item.ID, &item.WorkspaceID, &item.Operation, &item.FilePath,
			&item.Payload, &item.Status, &item.RetryCount, &item.ErrorMsg,
			&item.CreatedAt, &item.ProcessedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// UpdateSyncItemStatus updates the status of a sync queue item.
func (db *DB) UpdateSyncItemStatus(id int64, status, errorMsg string) error {
	_, err := db.conn.Exec(`
		UPDATE sync_queue SET status = ?, error_msg = ?, retry_count = retry_count + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
		processed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END
		WHERE id = ?
	`, status, errorMsg, status, status, id)
	return err
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
