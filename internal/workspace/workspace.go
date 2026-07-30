package workspace

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	"0x-excali/internal/database"
	"0x-excali/internal/diagram"
	"0x-excali/internal/github"
	"0x-excali/internal/sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// LocalWorkspaceRepoID is the sentinel repo_id for offline-only workspaces.
const LocalWorkspaceRepoID int64 = 0

// IsLocalWorkspace reports whether a workspace is local-only (no GitHub repo).
func IsLocalWorkspace(ws *database.Workspace) bool {
	return ws != nil && ws.RepoID == LocalWorkspaceRepoID
}

// Service manages workspace selection, local file tree cache, and diagram CRUD.
type Service struct {
	ctx      context.Context
	db       *database.DB
	ghClient *github.Client
	syncer   *sync.Engine
}

// NewService creates a new workspace service.
func NewService(db *database.DB, ghClient *github.Client) *Service {
	return &Service{
		db:       db,
		ghClient: ghClient,
	}
}

// SetContext stores the Wails runtime context.
func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// SetSyncEngine wires the push engine so SyncFileTree can push after pulling.
func (s *Service) SetSyncEngine(e *sync.Engine) {
	s.syncer = e
}

// ListGitHubRepositories fetches the user's repositories from GitHub.
// This proxies to the GitHub client so the frontend doesn't need raw API access.
func (s *Service) ListGitHubRepositories() ([]github.Repository, error) {
	return s.ghClient.ListRepositories(s.ctx)
}

// CreateGitHubRepository creates a new repository on GitHub.
func (s *Service) CreateGitHubRepository(name, description string, private bool) (*github.Repository, error) {
	return s.ghClient.CreateRepository(s.ctx, name, description, private)
}

// SelectWorkspace sets the given repository as the active workspace.
// It stores the repo metadata in SQLite and triggers an initial file tree sync.
func (s *Service) SelectWorkspace(repo github.Repository) error {
	ws := &database.Workspace{
		RepoID:        repo.ID,
		Owner:         repo.Owner,
		Name:          repo.Name,
		FullName:      repo.FullName,
		DefaultBranch: repo.DefaultBranch,
		IsPrivate:     repo.IsPrivate,
	}

	if err := s.db.UpsertWorkspace(s.ctx, ws); err != nil {
		return fmt.Errorf("failed to save workspace: %w", err)
	}

	log.Printf("workspace: selected %s", repo.FullName)
	return nil
}

// SelectLocalWorkspace activates the built-in local-only workspace.
func (s *Service) SelectLocalWorkspace() error {
	ws := &database.Workspace{
		RepoID:        LocalWorkspaceRepoID,
		Owner:         "local",
		Name:          "Local Workspace",
		FullName:      "local/workspace",
		DefaultBranch: "main",
		IsPrivate:     true,
	}

	if err := s.db.UpsertWorkspace(s.ctx, ws); err != nil {
		return fmt.Errorf("failed to save local workspace: %w", err)
	}

	log.Printf("workspace: selected local workspace")
	return nil
}

// IsActiveWorkspaceLocal reports whether the current workspace is local-only.
func (s *Service) IsActiveWorkspaceLocal() bool {
	return IsLocalWorkspace(s.GetActiveWorkspace())
}

// LinkGitHubRepository connects a GitHub repo and migrates local workspace content into it.
func (s *Service) LinkGitHubRepository(repo github.Repository) error {
	localWS, err := s.db.GetWorkspaceByRepoID(s.ctx, LocalWorkspaceRepoID)
	if err != nil {
		return fmt.Errorf("failed to look up local workspace: %w", err)
	}

	var localNodes []database.FileNode
	if localWS != nil {
		localNodes, err = s.db.GetAllFileNodes(s.ctx, localWS.ID)
		if err != nil {
			return fmt.Errorf("failed to read local workspace files: %w", err)
		}
	}

	if err := s.SelectWorkspace(repo); err != nil {
		return err
	}

	ghWS, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ghWS == nil {
		return fmt.Errorf("failed to activate GitHub workspace")
	}

	for _, node := range localNodes {
		copy := node
		copy.ID = 0
		copy.WorkspaceID = ghWS.ID
		copy.SHA = ""
		copy.IsDirty = true
		if err := s.db.UpsertFileNode(s.ctx, &copy); err != nil {
			return fmt.Errorf("failed to migrate %s: %w", node.Path, err)
		}

		if node.Type != "file" {
			continue
		}
		if node.Content == "" {
			continue
		}
		op := "create"
		if err := s.db.EnqueueSync(s.ctx, ghWS.ID, op, node.Path, node.Content); err != nil {
			return fmt.Errorf("failed to queue sync for %s: %w", node.Path, err)
		}
	}

	if s.syncer != nil {
		s.syncer.PushPending()
	}

	wailsRuntime.EventsEmit(s.ctx, "workspace:linked", repo.FullName)
	log.Printf("workspace: linked GitHub repo %s with %d migrated nodes", repo.FullName, len(localNodes))
	return nil
}

// SwitchWorkspace activates the given repository without syncing the previous one.
func (s *Service) SwitchWorkspace(repo github.Repository) error {
	if err := s.SelectWorkspace(repo); err != nil {
		return err
	}
	wailsRuntime.EventsEmit(s.ctx, "workspace:switched", repo.FullName)
	return nil
}

// RepoPendingStatus summarizes local unsynced state for a GitHub repository.
type RepoPendingStatus struct {
	RepoID        int64 `json:"repo_id"`
	HasPending    bool  `json:"has_pending"`
	DirtyCount    int   `json:"dirty_count"`
	PendingSyncs  int   `json:"pending_syncs"`
}

// GetRepoPendingStatus returns whether a repository has local changes not yet on GitHub.
func (s *Service) GetRepoPendingStatus(repoID int64) RepoPendingStatus {
	status := RepoPendingStatus{RepoID: repoID}

	ws, err := s.db.GetWorkspaceByRepoID(s.ctx, repoID)
	if err != nil || ws == nil {
		return status
	}

	if dirty, err := s.db.GetDirtyFiles(s.ctx, ws.ID); err == nil {
		status.DirtyCount = len(dirty)
	}
	if pending, err := s.db.CountPendingSyncItems(s.ctx, ws.ID); err == nil {
		status.PendingSyncs = pending
	}
	status.HasPending = status.DirtyCount > 0 || status.PendingSyncs > 0
	return status
}

// GetActiveWorkspace returns the currently active workspace, or nil if none is set.
func (s *Service) GetActiveWorkspace() *database.Workspace {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil {
		log.Printf("workspace: error getting active workspace: %v", err)
		return nil
	}
	return ws
}

// GetPendingSyncCount returns the number of sync operations waiting to be pushed
// for the active workspace.
func (s *Service) GetPendingSyncCount() int {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return 0
	}
	count, err := s.db.CountPendingSyncItems(s.ctx, ws.ID)
	if err != nil {
		return 0
	}
	return count
}

// HasPendingLocalChanges reports whether the active workspace has local edits waiting to be pushed.
func (s *Service) HasPendingLocalChanges() bool {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return false
	}

	hasPending, err := s.db.WorkspaceHasPendingChanges(s.ctx, ws.ID)
	if err != nil {
		return false
	}
	return hasPending
}

// SyncFileTree pushes any pending local changes, then fetches the remote tree.
// Preserves any locally dirty files (unsaved changes).
func (s *Service) SyncFileTree() error {
	return s.syncFileTree(true)
}

// PullFileTree fetches the remote repository tree without pushing local changes.
func (s *Service) PullFileTree() error {
	return s.syncFileTree(false)
}

func (s *Service) syncFileTree(pushLocalChanges bool) error {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return fmt.Errorf("no active workspace")
	}

	if IsLocalWorkspace(ws) {
		return nil
	}

	wailsRuntime.EventsEmit(s.ctx, "sync:tree:started")

	// Push local changes FIRST so deletes/creates/updates are committed before
	// we pull — otherwise the pull would resurrect files the user just deleted.
	if pushLocalChanges && s.syncer != nil && s.HasPendingLocalChanges() {
		s.syncer.PushPending()
	}

	// Fetch remote tree
	entries, err := s.ghClient.GetRepoTree(s.ctx, ws.Owner, ws.Name, ws.DefaultBranch)
	if err != nil {
		wailsRuntime.EventsEmit(s.ctx, "sync:tree:error", err.Error())
		return fmt.Errorf("failed to fetch repo tree: %w", err)
	}

	// Clear non-dirty cached nodes and rebuild
	if err := s.db.ClearFileTree(s.ctx, ws.ID); err != nil {
		return fmt.Errorf("failed to clear file tree cache: %w", err)
	}

	// Insert all remote entries
	for _, entry := range entries {
		parentPath := ""
		if idx := strings.LastIndex(entry.Path, "/"); idx >= 0 {
			parentPath = entry.Path[:idx]
		}

		node := &database.FileNode{
			WorkspaceID: ws.ID,
			Path:        entry.Path,
			Name:        entry.Name,
			Type:        entry.Type,
			SHA:         entry.SHA,
			ParentPath:  parentPath,
			SizeBytes:   int64(entry.Size),
			SyncedAt:    time.Now().Format(time.RFC3339),
			IsDirty:     false,
		}

		if err := s.db.UpsertFileNode(s.ctx, node); err != nil {
			log.Printf("workspace: failed to upsert node %s: %v", entry.Path, err)
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "sync:tree:completed")
	log.Printf("workspace: synced %d entries for %s", len(entries), ws.FullName)
	return nil
}

// GetFolderContents returns the children of a folder path.
// Pass empty string for root contents.
func (s *Service) GetFolderContents(parentPath string) []database.FileNode {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return nil
	}

	nodes, err := s.db.GetFolderContents(s.ctx, ws.ID, parentPath)
	if err != nil {
		log.Printf("workspace: error getting folder contents for '%s': %v", parentPath, err)
		return nil
	}
	return nodes
}

// validateItemName rejects names that are empty, reserved/hidden (dot-prefixed,
// e.g. .gitkeep or .settings), or contain a path separator.
func validateItemName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name cannot be empty")
	}
	if strings.HasPrefix(name, ".") {
		return fmt.Errorf("name cannot start with '.' (reserved for internal files)")
	}
	if strings.ContainsAny(name, "/\\") {
		return fmt.Errorf("name cannot contain a path separator")
	}
	return nil
}

// CreateFolder creates a new folder by adding a .gitkeep placeholder.
// GitHub doesn't support empty directories, so we create a hidden file.
func (s *Service) CreateFolder(folderPath string) error {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return fmt.Errorf("no active workspace")
	}

	folderName := filepath.Base(folderPath)
	if err := validateItemName(folderName); err != nil {
		return err
	}

	// Add the folder node locally
	parentPath := ""
	if idx := strings.LastIndex(folderPath, "/"); idx >= 0 {
		parentPath = folderPath[:idx]
	}

	node := &database.FileNode{
		WorkspaceID: ws.ID,
		Path:        folderPath,
		Name:        folderName,
		Type:        "folder",
		ParentPath:  parentPath,
		IsDirty:     true,
	}

	if err := s.db.UpsertFileNode(s.ctx, node); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	// Queue a .gitkeep file creation for sync (GitHub repos only)
	if !IsLocalWorkspace(ws) {
		gitkeepPath := folderPath + "/.gitkeep"
		if err := s.db.EnqueueSync(s.ctx, ws.ID, "create", gitkeepPath, ""); err != nil {
			return fmt.Errorf("saved locally but failed to queue sync: %w", err)
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "workspace:updated")
	return nil
}

// CreateDiagram creates a new blank diagram file.
func (s *Service) CreateDiagram(folderPath, name string) (*database.FileNode, error) {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return nil, fmt.Errorf("no active workspace")
	}

	if err := validateItemName(name); err != nil {
		return nil, err
	}

	if !strings.HasSuffix(name, diagram.FileExtension) {
		name = name + diagram.FileExtension
	}

	var diagramPath string
	if folderPath == "" {
		diagramPath = name
	} else {
		diagramPath = folderPath + "/" + name
	}

	blankDiagram := map[string]interface{}{
		"type":     diagram.JSONType,
		"version":  2,
		"source":   "0x-excali",
		"elements": []interface{}{},
		"appState": map[string]interface{}{
			"gridSize":            nil,
			"viewBackgroundColor": "#ffffff",
		},
		"files": map[string]interface{}{},
	}

	content, err := json.MarshalIndent(blankDiagram, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to create blank diagram: %w", err)
	}

	node := &database.FileNode{
		WorkspaceID: ws.ID,
		Path:        diagramPath,
		Name:        name,
		Type:        "file",
		Content:     string(content),
		ParentPath:  folderPath,
		SizeBytes:   int64(len(content)),
		IsDirty:     true,
	}

	if err := s.db.UpsertFileNode(s.ctx, node); err != nil {
		return nil, fmt.Errorf("failed to create diagram: %w", err)
	}

	// Queue for remote sync
	if !IsLocalWorkspace(ws) {
		if err := s.db.EnqueueSync(s.ctx, ws.ID, "create", diagramPath, string(content)); err != nil {
			return nil, fmt.Errorf("saved locally but failed to queue sync: %w", err)
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "workspace:updated")
	return node, nil
}

// SaveDiagram saves diagram content to the local DB and queues a sync.
func (s *Service) SaveDiagram(path, content string) error {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return fmt.Errorf("no active workspace")
	}

	// Get existing node for its SHA
	existing, err := s.db.GetFileByPath(s.ctx, ws.ID, path)
	if err != nil {
		return fmt.Errorf("failed to look up file: %w", err)
	}

	if existing != nil && existing.Content == content {
		return nil
	}

	sha := ""
	if existing != nil {
		sha = existing.SHA
	}

	// Update local DB
	if err := s.db.UpdateFileContent(s.ctx, ws.ID, path, content, sha); err != nil {
		return fmt.Errorf("failed to save diagram locally: %w", err)
	}

	// Queue for remote sync
	if !IsLocalWorkspace(ws) {
		if err := s.db.EnqueueSync(s.ctx, ws.ID, "update", path, content); err != nil {
			return fmt.Errorf("saved locally but failed to queue sync: %w", err)
		}
	}

	return nil
}

// GetDiagram retrieves the content of a diagram.
// First checks local cache, then fetches from GitHub if needed.
func (s *Service) GetDiagram(path string) (string, error) {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return "", fmt.Errorf("no active workspace")
	}

	// Check local cache first
	node, err := s.db.GetFileByPath(s.ctx, ws.ID, path)
	if err != nil {
		return "", fmt.Errorf("failed to look up file: %w", err)
	}

	if node != nil && node.Content != "" {
		return node.Content, nil
	}

	if IsLocalWorkspace(ws) {
		return "", fmt.Errorf("diagram not found: %s", path)
	}

	// Fetch from GitHub
	content, sha, err := s.ghClient.GetFileContent(s.ctx, ws.Owner, ws.Name, path, ws.DefaultBranch)
	if err != nil {
		return "", fmt.Errorf("failed to fetch from GitHub: %w", err)
	}

	// Cache locally
	if node != nil {
		_ = s.db.UpdateFileContent(s.ctx, ws.ID, path, content, sha)
	}

	return content, nil
}

// DeleteItem removes a file or folder from local cache and queues deletion.
func (s *Service) DeleteItem(path string) error {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return fmt.Errorf("no active workspace")
	}

	// Collect the actual files to remove from GitHub BEFORE deleting locally.
	// GitHub has no folder objects, so deleting a folder means deleting every
	// file under it; deleting a file just removes that one file.
	node, err := s.db.GetFileByPath(s.ctx, ws.ID, path)
	if err != nil {
		return fmt.Errorf("failed to look up item: %w", err)
	}

	var files []database.FileNode
	if node != nil && node.Type == "folder" {
		if under, ferr := s.db.GetFilesUnder(s.ctx, ws.ID, path); ferr == nil {
			files = under
		}
	} else if node != nil {
		files = []database.FileNode{{Path: node.Path, SHA: node.SHA}}
	}

	// Delete from local DB (removes the folder and all descendants)
	if err := s.db.DeleteFileNode(s.ctx, ws.ID, path); err != nil {
		return fmt.Errorf("failed to delete locally: %w", err)
	}

	// Queue a remote deletion for each file that exists on GitHub (has a SHA)
	if !IsLocalWorkspace(ws) {
		for _, f := range files {
			if f.SHA == "" {
				continue
			}
			payload, _ := json.Marshal(map[string]string{"sha": f.SHA})
			if err := s.db.EnqueueSync(s.ctx, ws.ID, "delete", f.Path, string(payload)); err != nil {
				return fmt.Errorf("deleted locally but failed to queue sync for %s: %w", f.Path, err)
			}
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "workspace:updated")
	return nil
}

// GetDirtyFileCount returns the number of files with unsaved changes.
func (s *Service) GetDirtyFileCount() int {
	ws, err := s.db.GetActiveWorkspace(s.ctx)
	if err != nil || ws == nil {
		return 0
	}

	dirty, err := s.db.GetDirtyFiles(s.ctx, ws.ID)
	if err != nil {
		return 0
	}
	return len(dirty)
}
