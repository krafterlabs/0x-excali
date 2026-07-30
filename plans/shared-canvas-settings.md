# Shared Canvas Settings — Repo-synced, All-canvas Applied

## Background

Currently `CanvasView.tsx` loads `canvasTheme` from `settings.Config` (stored in the local SQLite DB) and applies it as the `theme` prop. No other shared canvas state (font family, grid, background color) is synced across diagrams.

The request is to:
1. **Persist** a shared set of visual canvas settings (theme, font family, grid, view background color)
2. **Sync** them to the GitHub repo so they travel with the workspace
3. **Apply** them to every `CanvasView` automatically — change once, apply everywhere

---

## Design Decisions

**Where to store settings in the repo?**

A hidden file `.canvas-settings.json` at the repo root (like `.editorconfig`). It is excluded from the file tree UI (already filtered by the `name.startsWith(".")` rule in `loadAllNodes` and `validateItemName`). It travels through Git and is synced like any other file.

**What settings to sync?**

Only the visual/aesthetic state that makes sense to share across canvases:
- `theme`: `"dark"` | `"light"`
- `gridSize`: `number | null`
- `viewBackgroundColor`: hex string
- `currentItemFontFamily`: `1` (Virgil) | `2` (Helvetica) | `3` (Cascadia)

Per-diagram state (scroll position, selected elements, zoom) stays diagram-local.

**Where to wire this in the frontend?**

A new React context `CanvasSettingsContext` provides the shared settings to every `CanvasView`. Settings are loaded once at the `Workspace` level and pushed down. When a canvas's appState changes, it calls `updateCanvasSettings` which persists + re-emits the new values.

---

## Proposed Changes

### Backend — Go

#### [MODIFY] `internal/settings/settings.go`
- Add `CanvasFontFamily int` field to `Config`
- Update `DefaultConfig()` with sensible defaults

#### [MODIFY] `internal/workspace/workspace.go`
Add two new exported methods:
- `GetCanvasSettings() (string, error)` — reads `.canvas-settings.json` from the local DB (or returns `""` if not found)
- `SaveCanvasSettings(content string) error` — writes to local DB + queues a sync operation, mirrors how `SaveDiagram` works but targets the fixed path `.canvas-settings.json`

---

### Frontend — React / TypeScript

#### [NEW] `frontend/src/lib/canvas-settings.ts`
Defines the `CanvasSharedSettings` type and a `DEFAULT_CANVAS_SETTINGS` constant.

#### [NEW] `frontend/src/contexts/CanvasSettingsContext.tsx`
React context + hook `useCanvasSettings()` that exposes:
- `settings: CanvasSharedSettings`
- `updateSettings: (patch: Partial<CanvasSharedSettings>) => void`

Loaded at the `Workspace` level, persisted via `SaveCanvasSettings` on update.

#### [MODIFY] `frontend/src/pages/Workspace.tsx`
- Wrap children in `<CanvasSettingsProvider>` after loading settings from Go backend

#### [MODIFY] `frontend/src/pages/CanvasView.tsx`
- Replace the local `canvasTheme` state with `useCanvasSettings()`
- Pass `theme`, `gridSize`, `viewBackgroundColor`, and `currentItemFontFamily` from shared settings
- On `onChange`, detect if visual settings changed and call `updateSettings` for cross-canvas sync

---

## Verification Plan

### Manual Verification
1. Open any diagram → change theme to light → close → open another diagram → confirm it opens in light theme
2. Change font family in one canvas → open a second canvas → confirm font matches
3. Check that `.canvas-settings.json` appears in the sync queue and is pushed to GitHub on next sync
4. Confirm `.canvas-settings.json` is **not** visible in the sidebar file tree

---

## Notes

- Settings are written back from canvas `onChange` (debounced), but only if the relevant shared fields actually changed — otherwise every element drag would trigger a settings save.
- The `.canvas-settings.json` file is dot-prefixed so it is blocked by `validateItemName` intentionally — users should never create it manually. `SaveCanvasSettings` bypasses validation and writes it directly (same pattern as `.gitkeep`).
