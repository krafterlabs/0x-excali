package database

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

