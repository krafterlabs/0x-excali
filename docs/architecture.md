# 0x-excali Architecture

0x-excali is built on the [Wails framework](https://wails.io/), which allows writing desktop applications with a Go backend and a web-based frontend (React). The two layers communicate asynchronously via inter-process communication (IPC) bindings.

## High-Level Overview

1. **Backend (Go):** Handles file I/O, local database interactions, network requests to the GitHub API, state management, and cryptography.
2. **Frontend (React/TypeScript):** Handles the user interface, routing, rendering the Excalidraw canvas, and calling Go methods through auto-generated TypeScript bindings.

---

## Backend (`internal/`)

The Go backend is structured into modular packages for maintainability and separation of concerns.

### 1. `database` (`internal/database/`)
Manages local state using SQLite via the pure-Go `modernc.org/sqlite` driver (no cgo). The DB lives in the OS user-config dir and persists:
- The GitHub auth record, with the access token **encrypted** (AES-256-GCM; `crypto.go`).
- The active workspace (a GitHub repo's metadata).
- The `file_tree` cache — one row per file/folder, with content, SHA, and an `is_dirty` flag.
- The `sync_queue` — pending `create`/`update`/`delete` operations awaiting push.
- Key-value app settings.

### 2. `github` (`internal/github/`)
Interacts with the GitHub REST API.
- **Auth (`auth.go`):** Implements the OAuth Device Flow — CLI-like authentication with no local callback server. Polls for the token, fetches the user profile, encrypts and stores the token.
- **Client (`client.go`):** Thin authenticated HTTP wrapper — list/create repos, read the recursive repo tree, and create/update/delete file contents. Not exposed directly to the frontend; the `workspace` service proxies the safe surface.

### 3. `settings` (`internal/settings/`)
Manages app configuration and user preferences (theme, Excalidraw theme, export options, sync interval). Persisted to the local DB and optionally mirrored to `.settings/config.json` in the repo.

### 4. `sync` (`internal/sync/`)
The push side of synchronization. It is **not** a background daemon — there is no timer. `PushPending()` is invoked synchronously by `workspace.SyncFileTree` before each pull.
- Drains up to `batchSize` items from the `sync_queue`, one file operation per commit.
- Commit message for the batch is `"<ISO-timestamp> — <N> file(s) changed"`.
- Tolerant of stale queue items: a folder-path delete (GitHub 422 "is not a file") and an update for a locally-deleted file are treated as no-ops so they drain instead of retrying forever.
- Emits `sync:started` / `sync:completed` Wails events for the UI.

### 5. `workspace` (`internal/workspace/`)
A Workspace is a GitHub repository plus its local SQLite cache (there is no local folder on disk). This service is the frontend-facing proxy.
- `SyncFileTree` is the single sync entry point: **push queued changes, then pull** the recursive repo tree into the cache. Called at startup and on manual sync.
- Diagram CRUD: `CreateDiagram`, `SaveDiagram` (debounced autosave from the canvas), `GetDiagram` (cache-first, GitHub fallback), `CreateFolder` (via `.gitkeep`), and `DeleteItem` — which expands a folder into its member files so each is deleted individually.
- Repo helpers (`ListGitHubRepositories`, `CreateGitHubRepository`) proxy the encapsulated GitHub client.
- Holds a reference to the `sync.Engine` (wired in `app.go` via `SetSyncEngine`) to trigger the push.

---

## Frontend (`frontend/`)

The frontend is a single-page application built with **React, TypeScript, and Vite**.

### Tech Stack
- **Framework:** React 18
- **Bundler:** Vite (configured heavily for fast hot-reloading under Wails)
- **Styling:** [TailwindCSS v3](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Canvas:** `@excalidraw/excalidraw`

### Component Structure
- **Pages:** `AuthScreen.tsx` (device-flow polling), `WorkspaceSetup.tsx` (pick a repo), `Workspace.tsx` (the shell + file tree + create/delete dialogs), and `CanvasView.tsx` (the Excalidraw editor with debounced autosave).
- **Layout:** `AppShell` composes `Header` (workspace name, branch, sync status, settings menu), `Sidebar` (New diagram + `FolderTree`), and the main area. `EditorHeader` shows the file title/breadcrumb above the canvas.
- **Styling Architecture:**
  - `index.css` is the source of truth for light/dark theming via `oklch()` CSS variables; `tailwind.config.js` maps them into utilities (`bg-card`, `border-border`, …).
  - **Color rule:** orange is reserved for the primary action and selection; borders are neutral. Un-colored borders/outlines default to `transparent` in the base reset so no phantom box appears around buttons/panels; components opt into a border with an explicit color. Buttons carry no focus ring.
  - **Excalidraw isolation:** the base reset explicitly excludes `.excalidraw` (`*:not(.excalidraw):not(.excalidraw *)`) so app styles never leak into the canvas, which owns its own toolbar/menus/theme via the supported `theme` prop.

> **Note on search:** the command-palette / `Cmd+K` search was removed; there is currently no in-app search.

### Wails Integration
When the Go backend is compiled, Wails reads all exported structs and methods and generates TypeScript interfaces and client functions in `frontend/wailsjs/go/`. 

The React application imports these functions (e.g., `import { StartDeviceFlow } from '../../wailsjs/go/github/AuthService'`) and calls them asynchronously. Wails handles the IPC bridge between the browser window and the underlying Go process transparently.
