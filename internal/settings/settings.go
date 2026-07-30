package settings

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"0x-excali/internal/database"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// settingsKey is the DB key for the serialized settings config.
const settingsKey = "app_settings"

// Config represents all user-configurable settings, persisted to the local DB.
type Config struct {
	Theme            string `json:"theme"`           // "dark" | "light"
	CanvasTheme  string `json:"excalidrawTheme"` // persisted key; "dark" | "light"
	GridMode         bool   `json:"gridMode"`
	ExportBackground bool   `json:"exportBackground"`
	ExportDarkMode   bool   `json:"exportDarkMode"`
	AutoSync         bool   `json:"autoSync"`
	SyncIntervalSecs int    `json:"syncIntervalSecs"`
	LocalOnly        bool   `json:"localOnly"` // true when using app without GitHub
}

// Service manages application settings with local DB persistence.
type Service struct {
	ctx context.Context
	db  *database.DB
}

// NewService creates a new settings service.
func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

// SetContext stores the Wails runtime context.
func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// DefaultConfig returns the default settings configuration.
func DefaultConfig() Config {
	return Config{
		Theme:            "dark",
		CanvasTheme:  "dark",
		GridMode:         false,
		ExportBackground: true,
		ExportDarkMode:   true,
		AutoSync:         true,
		SyncIntervalSecs: 30,
	}
}

// GetSettings retrieves the current settings, or returns defaults if none exist.
func (s *Service) GetSettings() Config {
	raw, err := s.db.GetSetting(s.ctx, settingsKey)
	if err != nil || raw == "" {
		return DefaultConfig()
	}

	var config Config
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		log.Printf("settings: failed to parse stored settings, returning defaults: %v", err)
		return DefaultConfig()
	}

	return config
}

// EnableLocalMode marks the app as local-only and ensures a local workspace exists.
func (s *Service) EnableLocalMode() error {
	config := s.GetSettings()
	config.LocalOnly = true
	if err := s.UpdateSettings(config); err != nil {
		return err
	}
	wailsRuntime.EventsEmit(s.ctx, "settings:local-mode-enabled")
	return nil
}

// DisableLocalMode turns off local-only mode after GitHub is linked.
func (s *Service) DisableLocalMode() error {
	config := s.GetSettings()
	config.LocalOnly = false
	return s.UpdateSettings(config)
}

// IsLocalOnly returns whether the user is using the app without GitHub.
func (s *Service) IsLocalOnly() bool {
	return s.GetSettings().LocalOnly
}

// UpdateSettings saves new settings to the local DB and emits an update event.
func (s *Service) UpdateSettings(config Config) error {
	raw, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize settings: %w", err)
	}

	if err := s.db.SetSetting(s.ctx, settingsKey, string(raw)); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	wailsRuntime.EventsEmit(s.ctx, "settings:updated", config)
	return nil
}
