package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"0x-excali/internal/database"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	// Registered GitHub OAuth App's Client ID.
	ClientID = "Ov23liUtqFwW9bqt3VKk"

	deviceCodeURL = "https://github.com/login/device/code"
	tokenURL      = "https://github.com/login/oauth/access_token"
	userURL       = "https://api.github.com/user"
)

// AuthService handles GitHub Device Authorization Grant flow and token management.
type AuthService struct {
	ctx    context.Context
	db     *database.DB
	crypto *database.Crypto
	client *http.Client

	// cancelPoll allows cancelling an in-progress device flow poll
	cancelPoll context.CancelFunc
}

// DeviceCodeResponse is returned from GitHub's device/code endpoint.
type DeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

// AuthResult is returned to the frontend after an auth check or completion.
type AuthResult struct {
	Authenticated bool   `json:"authenticated"`
	Username      string `json:"username"`
	AvatarURL     string `json:"avatar_url"`
	Email         string `json:"email"`
	Error         string `json:"error,omitempty"`
}

// tokenResponse is the raw response from GitHub's token endpoint.
type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
	Interval    int    `json:"interval"` // Added to handle slow_down
}

// githubUser is the raw response from GET /user.
type githubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
	Name      string `json:"name"`
}

// NewAuthService creates a new AuthService with the given database and crypto subsystem.
func NewAuthService(db *database.DB, crypto *database.Crypto) *AuthService {
	return &AuthService{
		db:     db,
		crypto: crypto,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// SetContext stores the Wails runtime context (called from OnStartup).
func (a *AuthService) SetContext(ctx context.Context) {
	a.ctx = ctx
}

// GetAuthStatus checks the local DB for a valid stored token and returns the auth state.
// This is the first call the frontend makes on boot.
func (a *AuthService) GetAuthStatus() AuthResult {
	record, err := a.db.GetAuth()
	if err != nil {
		return AuthResult{Error: fmt.Sprintf("Failed to check auth: %v", err)}
	}
	if record == nil {
		return AuthResult{Authenticated: false}
	}

	// Verify we can decrypt the token (key hasn't changed)
	_, err = a.crypto.Decrypt(record.TokenEnc, record.TokenNonce)
	if err != nil {
		// Token can't be decrypted — treat as unauthenticated
		log.Printf("auth: stored token undecryptable, clearing: %v", err)
		_ = a.db.DeleteAuth()
		return AuthResult{Authenticated: false}
	}

	return AuthResult{
		Authenticated: true,
		Username:      record.Username,
		AvatarURL:     record.AvatarURL,
		Email:         record.Email,
	}
}

// StartDeviceFlow initiates the GitHub Device Authorization flow.
// If requestPrivateAccess is true, requests 'repo' scope (all repos). Otherwise requests 'public_repo' scope.
func (a *AuthService) StartDeviceFlow(requestPrivateAccess bool) (*DeviceCodeResponse, error) {
	scope := "public_repo"
	if requestPrivateAccess {
		scope = "repo"
	}

	data := url.Values{
		"client_id": {ClientID},
		"scope":     {scope},
	}

	req, err := http.NewRequest("POST", deviceCodeURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to request device code: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub returned status %d: %s", resp.StatusCode, string(body))
	}

	var dcr DeviceCodeResponse
	if err := json.Unmarshal(body, &dcr); err != nil {
		return nil, fmt.Errorf("failed to parse device code response: %w", err)
	}

	return &dcr, nil
}

// PollForToken starts a non-blocking background goroutine that polls GitHub for
// the access token. Emits Wails events:
//   - "auth:complete" with AuthResult on success
//   - "auth:error" with error string on failure
func (a *AuthService) PollForToken(deviceCode string, interval int, expiresIn int) {
	// Cancel any previous poll
	if a.cancelPoll != nil {
		a.cancelPoll()
	}

	pollCtx, cancel := context.WithTimeout(a.ctx, time.Duration(expiresIn)*time.Second)
	a.cancelPoll = cancel

	go func() {
		defer cancel()

		currentInterval := interval
		if currentInterval < 5 {
			currentInterval = 5
		}

		for {
			// Wait for the interval duration, or until context is done
			select {
			case <-pollCtx.Done():
				wailsRuntime.EventsEmit(a.ctx, "auth:error", "Authorization timed out or was cancelled")
				return
			case <-time.After(time.Duration(currentInterval) * time.Second):
				result, newInterval, done := a.pollOnce(deviceCode)
				
				if done {
					if result.Error != "" {
						wailsRuntime.EventsEmit(a.ctx, "auth:error", result.Error)
					} else {
						wailsRuntime.EventsEmit(a.ctx, "auth:complete", result)
					}
					return
				}
				
				// Update interval if GitHub requested a slow_down
				if newInterval > 0 {
					currentInterval = newInterval
				}
			}
		}
	}()
}

// OpenVerificationURL opens the GitHub verification URL in the system's default browser.
func (a *AuthService) OpenVerificationURL(verificationURI string) {
	wailsRuntime.BrowserOpenURL(a.ctx, verificationURI)
}

// Logout clears the stored auth token and emits a logout event.
func (a *AuthService) Logout() error {
	if err := a.db.DeleteAuth(); err != nil {
		return fmt.Errorf("failed to clear auth: %w", err)
	}
	wailsRuntime.EventsEmit(a.ctx, "auth:logout")
	return nil
}

// GetDecryptedToken retrieves and decrypts the stored GitHub token.
// Used internally by other services (not exposed to frontend via Wails).
func (a *AuthService) GetDecryptedToken() (string, error) {
	record, err := a.db.GetAuth()
	if err != nil {
		return "", fmt.Errorf("failed to get auth record: %w", err)
	}
	if record == nil {
		return "", fmt.Errorf("no auth token stored")
	}

	plaintext, err := a.crypto.Decrypt(record.TokenEnc, record.TokenNonce)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt token: %w", err)
	}

	return string(plaintext), nil
}

// pollOnce makes a single token poll request. Returns (result, newInterval, isDone).
func (a *AuthService) pollOnce(deviceCode string) (AuthResult, int, bool) {
	data := url.Values{
		"client_id":   {ClientID},
		"device_code": {deviceCode},
		"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
	}

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("[Auth] Error creating poll request: %v", err)
		return AuthResult{Error: err.Error()}, 0, true
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		log.Printf("[Auth] Poll request failed: %v", err)
		return AuthResult{Error: fmt.Sprintf("Poll request failed: %v", err)}, 0, true
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[Auth] Failed to read poll response: %v", err)
		return AuthResult{Error: fmt.Sprintf("Failed to read poll response: %v", err)}, 0, true
	}

	log.Printf("[Auth] Poll response: %s", string(body))

	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		log.Printf("[Auth] Failed to parse poll response: %v", err)
		return AuthResult{Error: fmt.Sprintf("Failed to parse poll response: %v", err)}, 0, true
	}

	switch tr.Error {
	case "authorization_pending":
		// User hasn't authorized yet — keep polling
		return AuthResult{}, 0, false
	case "slow_down":
		// We're polling too fast — update the interval!
		return AuthResult{}, tr.Interval, false
	case "expired_token":
		log.Printf("[Auth] Device code expired")
		return AuthResult{Error: "Device code expired. Please restart the authorization."}, 0, true
	case "access_denied":
		log.Printf("[Auth] Authorization denied")
		return AuthResult{Error: "Authorization was denied by the user."}, 0, true
	case "":
		// Success! We have a token.
		if tr.AccessToken == "" {
			log.Printf("[Auth] Received empty access token")
			return AuthResult{Error: "Received empty access token"}, 0, true
		}
		log.Printf("[Auth] Token received successfully!")
		res, done := a.handleSuccessfulAuth(tr.AccessToken, tr.Scope)
		return res, 0, done
	default:
		log.Printf("[Auth] Unexpected error: %s - %s", tr.Error, tr.ErrorDesc)
		return AuthResult{Error: fmt.Sprintf("Unexpected error: %s — %s", tr.Error, tr.ErrorDesc)}, 0, true
	}
}

// handleSuccessfulAuth fetches user profile, encrypts token, stores in DB.
func (a *AuthService) handleSuccessfulAuth(accessToken, scopes string) (AuthResult, bool) {
	// Fetch GitHub user profile
	user, err := a.fetchGitHubUser(accessToken)
	if err != nil {
		return AuthResult{Error: fmt.Sprintf("Failed to fetch user profile: %v", err)}, true
	}

	// Encrypt the token
	tokenEnc, tokenNonce, err := a.crypto.Encrypt([]byte(accessToken))
	if err != nil {
		return AuthResult{Error: fmt.Sprintf("Failed to encrypt token: %v", err)}, true
	}

	// Store in database
	record := &database.AuthRecord{
		GitHubID:   user.ID,
		Username:   user.Login,
		AvatarURL:  user.AvatarURL,
		Email:      user.Email,
		TokenEnc:   tokenEnc,
		TokenNonce: tokenNonce,
		Scopes:     scopes,
	}

	if err := a.db.UpsertAuth(record); err != nil {
		return AuthResult{Error: fmt.Sprintf("Failed to save auth record: %v", err)}, true
	}

	log.Printf("auth: successfully authenticated as %s (ID: %d)", user.Login, user.ID)

	return AuthResult{
		Authenticated: true,
		Username:      user.Login,
		AvatarURL:     user.AvatarURL,
		Email:         user.Email,
	}, true
}

// fetchGitHubUser calls GET /user with the given token.
func (a *AuthService) fetchGitHubUser(token string) (*githubUser, error) {
	req, err := http.NewRequest("GET", userURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	var user githubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &user, nil
}
