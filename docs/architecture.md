# 0x-excali Architecture

0x-excali is built on the [Wails v2 framework](https://wails.io/), which packages a Go backend and a React frontend into a native desktop application. The two layers communicate via auto-generated TypeScript bindings over an IPC bridge — no HTTP server, no REST API.

---

## High-Level Overview

```
┌─────────────────────────────────────┐
│           React Frontend            │
│  (TypeScript · Vite · Shadcn UI)    │
│                                     │
│  Pages → Wails IPC bindings         │
└────────────────┬────────────────────┘
                 │ IPC (Wails runtime)
┌────────────────▼────────────────────┐
│            Go Backend               │
│                                     │
│  app.go  ←→  services               │
│     ├── database  (SQLite)          │
│     ├── github    (REST API)        │
│     ├── settings  (config)          │
│     ├── sync      (push engine)     │
│     └── workspace (CRUD + sync)     │
└─────────────────────────────────────┘
```

1. **Backend (Go):** Handles local SQLite persistence, encrypted token storage, GitHub REST calls, sync queue management, and Wails event emission.
2. **Frontend (React/TypeScript):** Renders the UI, the drawing canvas, and calls Go methods via Wails-generated bindings in `frontend/wailsjs/go/`.

---

## Backend (`internal/`)

The Go backend is split into five cohesive packages. All services receive the Wails runtime context via `SetContext(ctx)` after startup so they can emit frontend events.

### Entry Point — `app.go`

`NewApp()` wires the full service graph:

```
DB → Crypto → AuthService → Client → WorkspaceService → SyncEngine
                                   → SettingsService
```

`startup(ctx)` propagates the context and starts the sync engine. `shutdown(ctx)` drains the engine and closes the DB.

---

### 1. `database` (`internal/database/`)

**Driver:** `modernc.org/sqlite` — pure Go, no cgo required.

**Location:** `os.UserConfigDir()/0x-excali/0x-excali.db`

**Connection settings:** single connection (`MaxOpenConns=1`), WAL journal mode, foreign keys ON.

#### Schema (5 tables)

| Table | Purpose |
|---|---|
| `auth` | One row per logged-in GitHub user. Access token stored as `token_enc` + `token_nonce` (AES-256-GCM). |
| `workspace` | Active GitHub repository metadata (owner, name, full_name, default_branch, is_private). |
| `file_tree` | Local mirror of the remote repo tree. One row per file/folder with path, name, type, sha, content, parent_path, is_dirty. |
| `settings` | Generic key/value store for app configuration. |
| `sync_queue` | Pending `create`/`update`/`delete` operations awaiting a push to GitHub. |

#### Key indices
- `idx_file_tree_workspace` — on `(workspace_id)`
- `idx_file_tree_parent` — on `(workspace_id, parent_path)` — powers O(1) folder children lookups
- `idx_sync_queue_status` — on `(status)` — powers the pending queue drain

#### Dirty-file semantics
`is_dirty = 1` means the local content differs from what was last pushed to GitHub. `ClearFileTree` only deletes non-dirty rows on a full re-sync, so local edits survive a pull. `MarkFileSynced` clears the flag and records the new remote SHA.

#### Sync queue retry logic
Items are fetched with `status IN ('pending', 'failed') AND retry_count < 3`. Each failure increments `retry_count`. After three failures an item is permanently skipped. The queue is drained oldest-first.

**Crypto (`crypto.go`):** `NewCrypto()` derives a machine-specific 32-byte key from `os.Hostname()` + `os.UserHomeDir()` via SHA-256. Token encrypt/decrypt uses `crypto/aes` + `crypto/cipher` (GCM). No external keychain dependency.

---

### 2. `github` (`internal/github/`)

Two files:

**`auth.go` — `AuthService`**
- Implements **OAuth Device Flow** — starts a poll loop, no local redirect server.
- On success: fetches the user profile, encrypts the token with AES-256-GCM, persists to `auth` table.
- Exposes `GetDecryptedToken()` for the HTTP client.
- `Logout()` deletes the auth row.

**`client.go` — `Client`**
Thin authenticated HTTP wrapper over `api.github.com`. All requests set:
- `Authorization: Bearer <token>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2022-11-28`
- 30-second timeout.

Public methods:

| Method | GitHub endpoint |
|---|---|
| `ListRepositories()` | `GET /user/repos` (up to 100, sorted by updated) |
| `CreateRepository()` | `POST /user/repos` (auto-init: true) |
| `GetRepoTree()` | `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` |
| `GetFileContent()` | `GET /repos/{owner}/{repo}/contents/{path}` — decodes base64 |
| `CreateOrUpdateFile()` | `PUT /repos/{owner}/{repo}/contents/{path}` — base64-encodes content |
| `DeleteFile()` | `DELETE /repos/{owner}/{repo}/contents/{path}` |

The `Client` is never exposed to the frontend directly; all calls go through `workspace.Service`.

---

### 3. `settings` (`internal/settings/`)

Manages **app-level** user preferences persisted in the local `settings` table under the key `app_settings`.

**`Config` struct:**

| Field | Type | Default |
|---|---|---|
| `theme` | string | `"dark"` |
| `excalidrawTheme` | string | `"dark"` |
| `gridMode` | bool | `false` |
| `exportBackground` | bool | `true` |
| `exportDarkMode` | bool | `true` |
| `autoSync` | bool | `true` |
| `syncIntervalSecs` | int | `30` |

`UpdateSettings()` serialises the struct to JSON, writes it to SQLite, and emits a `settings:updated` Wails event so the frontend can react without polling.

> **Note:** Settings are stored only in the local SQLite DB — they are **not** synced to the GitHub repo.

---

### 4. `sync` (`internal/sync/`)

The **push-only** sync engine. There is no background timer or daemon — `PushPending()` is called synchronously at the start of every `workspace.SyncFileTree()` (push-then-pull ordering).

**Batch size:** 10 items per call.

**Commit message format:** `"<ISO-8601 timestamp> — <N> file(s) changed"` (one commit per batch, not per file).

**Operation handlers:**

- `handleCreate` — calls `CreateOrUpdateFile` with empty SHA (new file).
- `handleUpdate` — looks up the current SHA from local cache; if missing, fetches it from GitHub; calls `CreateOrUpdateFile` with the SHA.
- `handleDelete` — parses the SHA from the queue payload JSON; if absent, fetches from GitHub; calls `DeleteFile`. If the path is not a file (GitHub 422 "is not a file" — stale folder-delete entry), logs and returns nil so the item drains cleanly.

After each item: marks `completed` or `failed` in the queue. After the batch: emits `sync:completed` Wails event with success/fail counts.

---

### 5. `workspace` (`internal/workspace/`)

The **frontend-facing service** — the only package bound directly to the Wails IPC surface.

**Key methods:**

| Method | What it does |
|---|---|
| `SelectWorkspace(repo)` | Upserts repo metadata to the `workspace` table |
| `GetActiveWorkspace()` | Returns the current workspace row |
| `SyncFileTree()` | **Push queued changes → pull remote tree into cache.** Emits `sync:tree:started` / `sync:tree:completed`. |
| `GetFolderContents(parentPath)` | Returns direct children of a folder from the local cache |
| `CreateDiagram(folderPath, name)` | Creates a blank diagram file locally + queues `create` |
| `CreateFolder(folderPath)` | Creates a folder node locally + queues a `.gitkeep` `create` |
| `SaveDiagram(path, content)` | Updates local content + queues `update`. Called by debounced autosave. |
| `GetDiagram(path)` | Cache-first (content present), GitHub fallback; caches the fetched content. |
| `DeleteItem(path)` | Expands folders to their member files, deletes all from local cache, queues `delete` for each file that has a remote SHA. |
| `GetDirtyFileCount()` | Returns count of `is_dirty=1` rows — drives the header badge. |
| `ListGitHubRepositories()` | Proxies `github.Client.ListRepositories()` |
| `CreateGitHubRepository()` | Proxies `github.Client.CreateRepository()` |

**Name validation (`validateItemName`):** rejects empty names, dot-prefixed names (reserved for `.gitkeep` and hidden files), and names with path separators. Internal operations like `.gitkeep` creation bypass this check directly.

---

## Data Flow — Full Sync Lifecycle

```
User edits diagram
    → CanvasView.onChange (debounced 1.5s)
    → SaveDiagram(path, content)
        → UpdateFileContent()   ← sets is_dirty=1 in file_tree
        → EnqueueSync("update", path, content)

User clicks Sync / app starts
    → SyncFileTree()
        → PushPending()               ← sync.Engine drains queue (batch=10)
            → CreateOrUpdateFile()    ← GitHub Contents API (PUT)
            → MarkFileSynced()        ← clears is_dirty, stores new SHA
        → GetRepoTree()               ← GitHub Trees API (recursive GET)
        → ClearFileTree()             ← removes non-dirty rows only
        → UpsertFileNode() × N        ← rebuilds cache from remote tree
        → EventsEmit("sync:tree:completed")
```

---

## Frontend (`frontend/`)

A single-page application: **React 18 + TypeScript + Vite**.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Bundler | Vite (`moduleResolution: "Bundler"`) |
| Styling | TailwindCSS v3 + Shadcn UI |
| Canvas | embedded drawing canvas (`@excalidraw/excalidraw`) |
| Routing | `wouter` |

### Pages

| Page | Role |
|---|---|
| `AuthScreen.tsx` | GitHub Device Flow — polls for token, shows code + URL |
| `WorkspaceSetup.tsx` | Repo picker / creator |
| `Workspace.tsx` | Main shell — file tree, create/delete dialogs, hosts `CanvasView` |
| `CanvasView.tsx` | Drawing editor with 1.5s debounced autosave |
| `LoadingScreen.tsx` | Splash while app initialises |

### Component Structure

- **`AppShell`** — composes `Header` + `Sidebar` + main content area.
- **`Header`** — workspace name, sync status badge, dirty-file count, settings menu, logout.
- **`Sidebar`** — "New diagram" button + `FolderTree` recursive component.
- **`EditorHeader`** — file title/breadcrumb shown above the canvas.
- **`SearchPalette`** — `Cmd+K` / `Ctrl+K` global fuzzy search over diagram names.

### Styling Architecture

- `index.css` is the single source of truth: light/dark theming via `oklch()` CSS variables; `tailwind.config.js` maps them into utilities (`bg-card`, `border-border`, …).
- **Shadcn UI Integration:** The app uses Shadcn UI components (powered by `@base-ui/react` and Radix primitives) for a modern, Next.js-style design system. Components include Buttons, Inputs, Dialogs, and Toasts for sync notifications.
- **Canvas isolation:** base reset uses `*:not(.excalidraw):not(.excalidraw *)` so app styles never leak into the drawing canvas.
- **Color convention:** orange is reserved for primary actions and selection; borders use `transparent` by default, and components opt in explicitly.

### Wails IPC Bindings

Wails generates TypeScript interfaces and async client functions in `frontend/wailsjs/go/` from all exported Go methods. The frontend imports them directly:

```ts
import { SaveDiagram } from '../../wailsjs/go/workspace/Service'
await SaveDiagram(path, content)
```

Runtime events (`EventsOn`) are used for server-push notifications (sync status changes, settings updates, workspace tree refresh).

---

## CI/CD Pipeline

### 1. Pre-Merge Validation (`validate-pr.yml`)
- Triggered on all PRs targeting `master`.
- Validates `.version` has been bumped.
- Runs a GraphQL query to block merge if any **unresolved review threads** exist.
- Path-filtering skips non-code files to save runner time.

### 2. Post-Merge Release (`auto-release.yml` → `reusable-release.yml`)
- Triggers after a PR is merged to `master`.
- Matrix-driven: currently targets **macOS arm64** (`macos-latest` runner).
- Build: `wails build -platform darwin/arm64 -m -s -clean`
- Package: `package-artifact.sh` creates a **DMG** containing the `.app` bundle + `/Applications` symlink + LICENSE + THIRD_PARTY_NOTICES.
- Release: uploaded as a **draft** GitHub Release via `softprops/action-gh-release`.

### 3. Native Git Hooks
- `.githooks/pre-commit` (enabled via `make setup`): runs `make build` before any commit, catching build regressions locally without requiring Node-based tooling like husky.
