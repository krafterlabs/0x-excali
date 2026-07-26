package database

import (
	"context"
	"database/sql"
)

// --- Workspace CRUD ---

// UpsertWorkspace inserts or updates a workspace. Deactivates all others first.
func (db *DB) UpsertWorkspace(ctx context.Context, ws *Workspace) error {
	tx, err := db.conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Deactivate all existing workspaces
	if _, err := tx.ExecContext(ctx, `UPDATE workspace SET is_active = 0`); err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
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
func (db *DB) GetActiveWorkspace(ctx context.Context) (*Workspace, error) {
	row := db.conn.QueryRowContext(ctx, `
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
