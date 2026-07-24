package github

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	githubAPIBase = "https://api.github.com"
	apiVersion    = "2022-11-28"
)

// Client provides authenticated access to the GitHub REST API.
// Token retrieval is deferred to AuthService to keep concerns separated.
type Client struct {
	authService *AuthService
	httpClient  *http.Client
}

// Repository represents a GitHub repository.
type Repository struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	Owner         string `json:"owner"`
	Description   string `json:"description"`
	IsPrivate     bool   `json:"is_private"`
	DefaultBranch string `json:"default_branch"`
	UpdatedAt     string `json:"updated_at"`
}

// FileEntry represents a file or directory in the repository tree.
type FileEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Type string `json:"type"` // "blob" (file) or "tree" (directory)
	SHA  string `json:"sha"`
	Size int    `json:"size"`
}

// FileContentResponse represents the response from the contents API.
type FileContentResponse struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	SHA     string `json:"sha"`
	Size    int    `json:"size"`
	Content string `json:"content"`  // base64 encoded
	Type    string `json:"type"`     // "file" or "dir"
}

// CreateRepoRequest is the payload for creating a new repository.
type CreateRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Private     bool   `json:"private"`
	AutoInit    bool   `json:"auto_init"`
}

// --- Internal GitHub API response types ---

type ghRepo struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	FullName      string  `json:"full_name"`
	Owner         ghOwner `json:"owner"`
	Description   string  `json:"description"`
	Private       bool    `json:"private"`
	DefaultBranch string  `json:"default_branch"`
	UpdatedAt     string  `json:"updated_at"`
}

type ghOwner struct {
	Login string `json:"login"`
}

type ghTree struct {
	SHA  string       `json:"sha"`
	Tree []ghTreeNode `json:"tree"`
}

type ghTreeNode struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"` // "blob" or "tree"
	SHA  string `json:"sha"`
	Size int    `json:"size"`
}

type ghUpdateFileRequest struct {
	Message string `json:"message"`
	Content string `json:"content"` // base64 encoded
	SHA     string `json:"sha,omitempty"`
	Branch  string `json:"branch,omitempty"`
}

type ghDeleteFileRequest struct {
	Message string `json:"message"`
	SHA     string `json:"sha"`
	Branch  string `json:"branch,omitempty"`
}

type ghContentResponse struct {
	Content struct {
		Name string `json:"name"`
		Path string `json:"path"`
		SHA  string `json:"sha"`
		Size int    `json:"size"`
	} `json:"content"`
}

// NewClient creates a new GitHub API client.
func NewClient(authService *AuthService) *Client {
	return &Client{
		authService: authService,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// ListRepositories fetches all repositories the authenticated user has access to.
// Returns up to 100 repos, sorted by most recently updated.
func (c *Client) ListRepositories() ([]Repository, error) {
	body, err := c.doRequest("GET", "/user/repos?sort=updated&per_page=100&type=all", nil)
	if err != nil {
		return nil, fmt.Errorf("list repos: %w", err)
	}

	var ghRepos []ghRepo
	if err := json.Unmarshal(body, &ghRepos); err != nil {
		return nil, fmt.Errorf("list repos: failed to parse: %w", err)
	}

	repos := make([]Repository, len(ghRepos))
	for i, r := range ghRepos {
		repos[i] = Repository{
			ID:            r.ID,
			Name:          r.Name,
			FullName:      r.FullName,
			Owner:         r.Owner.Login,
			Description:   r.Description,
			IsPrivate:     r.Private,
			DefaultBranch: r.DefaultBranch,
			UpdatedAt:     r.UpdatedAt,
		}
	}
	return repos, nil
}

// CreateRepository creates a new GitHub repository for the authenticated user.
func (c *Client) CreateRepository(name, description string, isPrivate bool) (*Repository, error) {
	payload := CreateRepoRequest{
		Name:        name,
		Description: description,
		Private:     isPrivate,
		AutoInit:    true, // creates initial commit with README
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("create repo: marshal failed: %w", err)
	}

	body, err := c.doRequest("POST", "/user/repos", jsonPayload)
	if err != nil {
		return nil, fmt.Errorf("create repo: %w", err)
	}

	var r ghRepo
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("create repo: failed to parse: %w", err)
	}

	repo := &Repository{
		ID:            r.ID,
		Name:          r.Name,
		FullName:      r.FullName,
		Owner:         r.Owner.Login,
		Description:   r.Description,
		IsPrivate:     r.Private,
		DefaultBranch: r.DefaultBranch,
		UpdatedAt:     r.UpdatedAt,
	}
	return repo, nil
}

// GetRepoTree fetches the full recursive tree of a repository at a given branch/ref.
func (c *Client) GetRepoTree(owner, repo, branch string) ([]FileEntry, error) {
	path := fmt.Sprintf("/repos/%s/%s/git/trees/%s?recursive=1", owner, repo, branch)
	body, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("get tree: %w", err)
	}

	var tree ghTree
	if err := json.Unmarshal(body, &tree); err != nil {
		return nil, fmt.Errorf("get tree: failed to parse: %w", err)
	}

	entries := make([]FileEntry, 0, len(tree.Tree))
	for _, node := range tree.Tree {
		// Extract the base name from the path
		name := node.Path
		for i := len(name) - 1; i >= 0; i-- {
			if name[i] == '/' {
				name = name[i+1:]
				break
			}
		}

		entryType := "file"
		if node.Type == "tree" {
			entryType = "folder"
		}

		entries = append(entries, FileEntry{
			Path: node.Path,
			Name: name,
			Type: entryType,
			SHA:  node.SHA,
			Size: node.Size,
		})
	}
	return entries, nil
}

// GetFileContent fetches the content of a single file from the repository.
// Returns the decoded (non-base64) content as a string.
func (c *Client) GetFileContent(owner, repo, path, ref string) (string, string, error) {
	apiPath := fmt.Sprintf("/repos/%s/%s/contents/%s", owner, repo, path)
	if ref != "" {
		apiPath += "?ref=" + ref
	}

	body, err := c.doRequest("GET", apiPath, nil)
	if err != nil {
		return "", "", fmt.Errorf("get file: %w", err)
	}

	var fcr FileContentResponse
	if err := json.Unmarshal(body, &fcr); err != nil {
		return "", "", fmt.Errorf("get file: failed to parse: %w", err)
	}

	// Decode base64 content
	decoded, err := base64.StdEncoding.DecodeString(fcr.Content)
	if err != nil {
		return "", "", fmt.Errorf("get file: failed to decode content: %w", err)
	}

	return string(decoded), fcr.SHA, nil
}

// CreateOrUpdateFile creates or updates a file in the repository.
// If sha is empty, creates a new file; otherwise updates the existing one.
// Returns the new SHA of the file.
func (c *Client) CreateOrUpdateFile(owner, repo, path, content, message, sha string) (string, error) {
	apiPath := fmt.Sprintf("/repos/%s/%s/contents/%s", owner, repo, path)

	payload := ghUpdateFileRequest{
		Message: message,
		Content: base64.StdEncoding.EncodeToString([]byte(content)),
	}
	if sha != "" {
		payload.SHA = sha
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("update file: marshal failed: %w", err)
	}

	body, err := c.doRequest("PUT", apiPath, jsonPayload)
	if err != nil {
		return "", fmt.Errorf("update file: %w", err)
	}

	var result ghContentResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("update file: failed to parse response: %w", err)
	}

	return result.Content.SHA, nil
}

// DeleteFile removes a file from the repository.
func (c *Client) DeleteFile(owner, repo, path, sha, message string) error {
	apiPath := fmt.Sprintf("/repos/%s/%s/contents/%s", owner, repo, path)

	payload := ghDeleteFileRequest{
		Message: message,
		SHA:     sha,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("delete file: marshal failed: %w", err)
	}

	_, err = c.doRequest("DELETE", apiPath, jsonPayload)
	if err != nil {
		return fmt.Errorf("delete file: %w", err)
	}

	return nil
}

// doRequest performs an authenticated API request with the given HTTP method
// and returns the response body.
func (c *Client) doRequest(method, path string, payload []byte) ([]byte, error) {
	token, err := c.authService.GetDecryptedToken()
	if err != nil {
		return nil, fmt.Errorf("auth required: %w", err)
	}

	fullURL := githubAPIBase + path

	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", apiVersion)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GitHub API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}
