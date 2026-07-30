package database

import (
	"context"
)

// --- Sync Queue CRUD ---

// EnqueueSync adds an operation to the sync queue.
func (db *DB) EnqueueSync(ctx context.Context, workspaceID int64, operation, filePath, payload string) error {
	_, err := db.conn.ExecContext(ctx, `
		INSERT INTO sync_queue (workspace_id, operation, file_path, payload)
		VALUES (?, ?, ?, ?)
	`, workspaceID, operation, filePath, payload)
	return err
}

// CountPendingSyncItems returns how many sync operations are waiting to be pushed
// for the given workspace.
func (db *DB) CountPendingSyncItems(ctx context.Context, workspaceID int64) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM sync_queue
		WHERE workspace_id = ? AND status IN ('pending', 'failed') AND retry_count < 3
	`, workspaceID).Scan(&count)
	return count, err
}

// WorkspaceHasPendingChanges reports whether a workspace has dirty files or queued sync ops.
func (db *DB) WorkspaceHasPendingChanges(ctx context.Context, workspaceID int64) (bool, error) {
	pending, err := db.CountPendingSyncItems(ctx, workspaceID)
	if err != nil {
		return false, err
	}
	if pending > 0 {
		return true, nil
	}

	dirty, err := db.GetDirtyFiles(ctx, workspaceID)
	if err != nil {
		return false, err
	}
	return len(dirty) > 0, nil
}

// GetPendingSyncItems returns pending sync operations for a workspace, oldest first.
func (db *DB) GetPendingSyncItems(ctx context.Context, workspaceID int64, limit int) ([]SyncQueueItem, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, workspace_id, operation, file_path, payload, status, retry_count, error_msg, created_at, COALESCE(processed_at, '')
		FROM sync_queue
		WHERE workspace_id = ? AND status IN ('pending', 'failed') AND retry_count < 3
		ORDER BY created_at ASC
		LIMIT ?
	`, workspaceID, limit)
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
func (db *DB) UpdateSyncItemStatus(ctx context.Context, id int64, status, errorMsg string) error {
	_, err := db.conn.ExecContext(ctx, `
		UPDATE sync_queue SET status = ?, error_msg = ?, retry_count = retry_count + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
		processed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END
		WHERE id = ?
	`, status, errorMsg, status, status, id)
	return err
}
