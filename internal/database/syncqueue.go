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

// CountPendingSyncItems returns how many sync operations are waiting to be pushed.
func (db *DB) CountPendingSyncItems(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM sync_queue
		WHERE status IN ('pending', 'failed') AND retry_count < 3
	`).Scan(&count)
	return count, err
}

// GetPendingSyncItems returns all pending sync operations, oldest first.
func (db *DB) GetPendingSyncItems(ctx context.Context, limit int) ([]SyncQueueItem, error) {
	rows, err := db.conn.QueryContext(ctx, `
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
func (db *DB) UpdateSyncItemStatus(ctx context.Context, id int64, status, errorMsg string) error {
	_, err := db.conn.ExecContext(ctx, `
		UPDATE sync_queue SET status = ?, error_msg = ?, retry_count = retry_count + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
		processed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END
		WHERE id = ?
	`, status, errorMsg, status, status, id)
	return err
}

