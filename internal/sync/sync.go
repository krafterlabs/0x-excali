package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"log"
	"strings"
	"time"

	"0x-excali/internal/database"
	"0x-excali/internal/github"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const batchSize = 10

// Engine pushes queued local changes to GitHub. It does not run on a timer:
// the push is triggered explicitly at app startup and on manual sync, right
// after the pull (see workspace.SyncFileTree).
type Engine struct {
	ctx        context.Context
	db         *database.DB
	ghClient   *github.Client
	cancelFunc context.CancelFunc
}

// NewEngine creates a new sync engine.
func NewEngine(db *database.DB, ghClient *github.Client) *Engine {
	return &Engine{
		db:       db,
		ghClient: ghClient,
	}
}

// Start stores the Wails runtime context so the engine can emit events.
// It does not spawn any background loop — syncs are triggered explicitly.
func (e *Engine) Start(ctx context.Context) {
	syncCtx, cancel := context.WithCancel(ctx)
	e.ctx = syncCtx
	e.cancelFunc = cancel
	log.Println("sync: engine ready (manual + startup only)")
}

// Stop cancels any in-flight push.
func (e *Engine) Stop() {
	if e.cancelFunc != nil {
		e.cancelFunc()
		log.Println("sync: engine stopped")
	}
}

// PushPending pushes the queued local changes to GitHub and blocks until done.
// Called (synchronously) at the start of every sync — before the pull — so that
// local deletes/creates are committed before the remote tree is fetched.
func (e *Engine) PushPending() {
	e.processPendingItems()
}

// processPendingItems fetches and processes all pending sync queue items.
func (e *Engine) processPendingItems() {
	ws, err := e.db.GetActiveWorkspace(e.ctx)
	if err != nil || ws == nil {
		return // No workspace — nothing to sync
	}

	items, err := e.db.GetPendingSyncItems(e.ctx, ws.ID, batchSize)
	if err != nil {
		log.Printf("sync: failed to fetch pending items: %v", err)
		return
	}

	if len(items) == 0 {
		return
	}

	wailsRuntime.EventsEmit(e.ctx, "sync:started", len(items))

	// One commit message for the whole batch: timestamp + number of files changed.
	commitMsg := fmt.Sprintf("%s — %d file(s) changed", time.Now().Format(time.RFC3339), len(items))

	successCount := 0
	failCount := 0

	for _, item := range items {
		// Mark as in progress
		_ = e.db.UpdateSyncItemStatus(e.ctx, item.ID, "in_progress", "")

		err := e.processItem(ws, &item, commitMsg)
		if err != nil {
			log.Printf("sync: failed to process item %d (%s %s): %v",
				item.ID, item.Operation, item.FilePath, err)
			_ = e.db.UpdateSyncItemStatus(e.ctx, item.ID, "failed", err.Error())
			failCount++
		} else {
			_ = e.db.UpdateSyncItemStatus(e.ctx, item.ID, "completed", "")
			successCount++
		}
	}

	wailsRuntime.EventsEmit(e.ctx, "sync:completed", map[string]int{
		"success": successCount,
		"failed":  failCount,
	})

	if failCount > 0 {
		log.Printf("sync: batch completed — %d success, %d failed", successCount, failCount)
	}
}

// processItem handles a single sync queue operation.
func (e *Engine) processItem(ws *database.Workspace, item *database.SyncQueueItem, commitMsg string) error {
	switch item.Operation {
	case "create":
		return e.handleCreate(ws, item, commitMsg)
	case "update":
		return e.handleUpdate(ws, item, commitMsg)
	case "delete":
		return e.handleDelete(ws, item, commitMsg)
	default:
		return fmt.Errorf("unknown operation: %s", item.Operation)
	}
}

// handleCreate pushes a new file to GitHub.
func (e *Engine) handleCreate(ws *database.Workspace, item *database.SyncQueueItem, commitMsg string) error {
	content := item.Payload

	newSHA, err := e.ghClient.CreateOrUpdateFile(
		e.ctx, ws.Owner, ws.Name, item.FilePath, content, commitMsg, "",
	)
	if err != nil {
		var apiErr *github.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode == 422 {
			// File exists remotely. Fetch its SHA and retry.
			_, existingSHA, getErr := e.ghClient.GetFileContent(e.ctx, ws.Owner, ws.Name, item.FilePath, "")
			if getErr != nil {
				return fmt.Errorf("failed to get existing file SHA: %w (original err: %v)", getErr, err)
			}
			newSHA, err = e.ghClient.CreateOrUpdateFile(
				e.ctx, ws.Owner, ws.Name, item.FilePath, content, commitMsg, existingSHA,
			)
			if err != nil {
				return fmt.Errorf("failed to update existing file on GitHub: %w", err)
			}
		} else {
			return fmt.Errorf("failed to create file on GitHub: %w", err)
		}
	}

	// Update local cache with the new SHA
	_ = e.db.MarkFileSynced(e.ctx, ws.ID, item.FilePath, newSHA)
	return nil
}

// handleUpdate pushes file changes to GitHub.
func (e *Engine) handleUpdate(ws *database.Workspace, item *database.SyncQueueItem, commitMsg string) error {
	// Get the current SHA from local cache
	node, err := e.db.GetFileByPath(e.ctx, ws.ID, item.FilePath)
	if err != nil {
		return fmt.Errorf("failed to look up %s: %w", item.FilePath, err)
	}
	if node == nil {
		// File was deleted locally after this update was queued — nothing to push.
		log.Printf("sync: %s gone from local cache, skipping stale update", item.FilePath)
		return nil
	}

	sha := node.SHA

	// If we don't have a SHA, try to get it from GitHub (file may have been created externally)
	if sha == "" {
		_, remoteSHA, fetchErr := e.ghClient.GetFileContent(e.ctx, ws.Owner, ws.Name, item.FilePath, ws.DefaultBranch)
		if fetchErr == nil {
			sha = remoteSHA
		}
		// If still no SHA, it'll be treated as a create
	}

	content := item.Payload

	newSHA, err := e.ghClient.CreateOrUpdateFile(
		e.ctx, ws.Owner, ws.Name, item.FilePath, content, commitMsg, sha,
	)
	if err != nil {
		return fmt.Errorf("failed to update file on GitHub: %w", err)
	}

	// Update local cache with the new SHA
	_ = e.db.MarkFileSynced(e.ctx, ws.ID, item.FilePath, newSHA)
	return nil
}

// handleDelete removes a file from GitHub.
func (e *Engine) handleDelete(ws *database.Workspace, item *database.SyncQueueItem, commitMsg string) error {
	// Parse the SHA from the payload
	var deleteInfo struct {
		SHA string `json:"sha"`
	}

	if err := json.Unmarshal([]byte(item.Payload), &deleteInfo); err != nil || deleteInfo.SHA == "" {
		// Try to fetch the SHA from GitHub
		_, remoteSHA, fetchErr := e.ghClient.GetFileContent(e.ctx, ws.Owner, ws.Name, item.FilePath, ws.DefaultBranch)
		if fetchErr != nil {
			// File might already be deleted — treat as success
			log.Printf("sync: file %s may already be deleted from GitHub", item.FilePath)
			return nil
		}
		deleteInfo.SHA = remoteSHA
	}

	if err := e.ghClient.DeleteFile(e.ctx, ws.Owner, ws.Name, item.FilePath, deleteInfo.SHA, commitMsg); err != nil {
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "Not Found") {
			log.Printf("sync: file %s not found on GitHub during delete (already deleted), skipping", item.FilePath)
			return nil
		}

		if strings.Contains(err.Error(), "is not a file") {
			log.Printf("sync: %s is not a file (folder), skipping remote delete", item.FilePath)
			return nil
		}
		return fmt.Errorf("failed to delete file on GitHub: %w", err)
	}

	return nil
}
