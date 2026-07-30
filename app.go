package main

import (
	"context"
	"log"

	"0x-excali/internal/database"
	"0x-excali/internal/github"
	"0x-excali/internal/settings"
	"0x-excali/internal/sync"
	"0x-excali/internal/workspace"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main application struct. It holds references to all services
// and is bound to the Wails runtime for frontend access.
type App struct {
	ctx context.Context

	// Internal (not bound to Wails)
	db     *database.DB
	crypto *database.Crypto
	syncer *sync.Engine

	// Bound services (accessible from frontend)
	Auth      *github.AuthService `json:"-"`
	Workspace *workspace.Service  `json:"-"`
	Settings  *settings.Service   `json:"-"`
}

// NewApp initializes the application and all its services.
// The database and crypto subsystems are initialized eagerly so that
// service constructors have what they need.
func NewApp() *App {
	// Initialize database
	db, err := database.New()
	if err != nil {
		log.Fatalf("FATAL: failed to initialize database: %v", err)
	}

	// Initialize encryption subsystem
	crypto, err := database.NewCrypto()
	if err != nil {
		log.Fatalf("FATAL: failed to initialize crypto: %v", err)
	}

	// Build service graph
	authService := github.NewAuthService(db, crypto)
	ghClient := github.NewClient(authService)
	workspaceService := workspace.NewService(db, ghClient)
	settingsService := settings.NewService(db)
	syncEngine := sync.NewEngine(db, ghClient)
	workspaceService.SetSyncEngine(syncEngine)

	return &App{
		db:        db,
		crypto:    crypto,
		syncer:    syncEngine,
		Auth:      authService,
		Workspace: workspaceService,
		Settings:  settingsService,
	}
}

// startup is called when the Wails app starts. It propagates the runtime
// context to all services and starts the background sync engine.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Propagate context to all services that need it
	a.Auth.SetContext(ctx)
	a.Workspace.SetContext(ctx)
	a.Settings.SetContext(ctx)

	// Start background sync engine
	a.syncer.Start(ctx)

	log.Println("app: all services initialized and ready")
}

// shutdown is called when the Wails app is closing. It gracefully stops
// the sync engine and closes the database connection.
func (a *App) shutdown(ctx context.Context) {
	a.syncer.Stop()

	if err := a.db.Close(); err != nil {
		log.Printf("app: error closing database: %v", err)
	}

	log.Println("app: shutdown complete")
}

// OpenExternalURL opens an http(s) URL in the system default browser.
func (a *App) OpenExternalURL(url string) {
	wailsRuntime.BrowserOpenURL(a.ctx, url)
}
