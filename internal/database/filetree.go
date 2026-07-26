package database

import (
	"context"
	"database/sql"
)

// --- File Tree CRUD ---

// UpsertFileNode inserts or updates a file tree node.
func (db *DB) UpsertFileNode(ctx context.Context, node *FileNode) error {
	_, err := db.conn.ExecContext(ctx, `
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
func (db *DB) GetFolderContents(ctx context.Context, workspaceID int64, parentPath string) ([]FileNode, error) {
	rows, err := db.conn.QueryContext(ctx, `
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
func (db *DB) GetFileByPath(ctx context.Context, workspaceID int64, path string) (*FileNode, error) {
	row := db.conn.QueryRowContext(ctx, `
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
func (db *DB) UpdateFileContent(ctx context.Context, workspaceID int64, path, content, sha string) error {
	_, err := db.conn.ExecContext(ctx, `
		UPDATE file_tree SET content = ?, sha = ?, is_dirty = 1, updated_at = CURRENT_TIMESTAMP
		WHERE workspace_id = ? AND path = ?
	`, content, sha, workspaceID, path)
	return err
}

// MarkFileSynced clears the dirty flag and updates synced_at.
func (db *DB) MarkFileSynced(ctx context.Context, workspaceID int64, path, newSHA string) error {
	_, err := db.conn.ExecContext(ctx, `
		UPDATE file_tree SET is_dirty = 0, sha = ?, synced_at = CURRENT_TIMESTAMP
		WHERE workspace_id = ? AND path = ?
	`, newSHA, workspaceID, path)
	return err
}

// DeleteFileNode removes a file tree node and all its children (if folder).
func (db *DB) DeleteFileNode(ctx context.Context, workspaceID int64, path string) error {
	tx, err := db.conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete children first (for folders)
	if _, err := tx.ExecContext(ctx, `DELETE FROM file_tree WHERE workspace_id = ? AND (path = ? OR path LIKE ?)`,
		workspaceID, path, path+"/%"); err != nil {
		return err
	}

	return tx.Commit()
}

// ClearFileTree removes all file tree nodes for a workspace (used before full re-sync).
func (db *DB) ClearFileTree(ctx context.Context, workspaceID int64) error {
	_, err := db.conn.ExecContext(ctx, `DELETE FROM file_tree WHERE workspace_id = ? AND is_dirty = 0`, workspaceID)
	return err
}

// GetDirtyFiles returns all files marked as dirty for a workspace.
func (db *DB) GetDirtyFiles(ctx context.Context, workspaceID int64) ([]FileNode, error) {
	rows, err := db.conn.QueryContext(ctx, `
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
func (db *DB) GetFilesUnder(ctx context.Context, workspaceID int64, path string) ([]FileNode, error) {
	rows, err := db.conn.QueryContext(ctx, `
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

