package database

import (
	"context"
	"database/sql"
)

// --- Settings CRUD ---

// GetSetting retrieves a single setting by key, or empty string if not found.
func (db *DB) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := db.conn.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// SetSetting inserts or updates a setting.
func (db *DB) SetSetting(ctx context.Context, key, value string) error {
	_, err := db.conn.ExecContext(ctx, `
		INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = CURRENT_TIMESTAMP
	`, key, value)
	return err
}
