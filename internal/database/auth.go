package database

import (
	"context"
	"database/sql"
)

// --- Auth CRUD ---

// UpsertAuth inserts or updates the authentication record.
func (db *DB) UpsertAuth(ctx context.Context, record *AuthRecord) error {
	_, err := db.conn.ExecContext(ctx, `
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
func (db *DB) GetAuth(ctx context.Context) (*AuthRecord, error) {
	row := db.conn.QueryRowContext(ctx, `SELECT id, github_id, username, avatar_url, email, token_enc, token_nonce, scopes, created_at, updated_at FROM auth LIMIT 1`)

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
func (db *DB) DeleteAuth(ctx context.Context) error {
	_, err := db.conn.ExecContext(ctx, `DELETE FROM auth`)
	return err
}
