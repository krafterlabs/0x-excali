# Shared Excalidraw Settings — Repo-synced, All-canvas Applied

## Background

Currently `CanvasView.tsx` loads `excalidrawTheme` once from `settings.Config` (which is stored in the local SQLite DB) and applies it as the `theme` prop. No other Excalidraw state (font family, grid, background color) is shared.

The request is to:
1. **Persist** a shared set of Excalidraw visual settings (theme, font family, grid, view background color)
2. **Sync** them to the GitHub repo so they travel with the workspace
3. **Apply** them to every `CanvasView` automatically — change once, apply everywhere

---

## Design Decisions

**Where to store settings in the repo?**

A hidden file `.excalidraw-settings.json` at the repo root (like `.editorconfig`). It is excluded from the file tree UI (already filtered by the `name.startsWith(".")` rule in `loadAllNodes` and `validateItemName`). It travels through Git and is synced like any other file.

**What settings to sync?**

Only the visual/aesthetic state that makes sense to share across canvases:
- `theme`: `"dark"` | `"light"`
- `gridSize`: `number | null`
- `viewBackgroundColor`: hex string
- `currentItemFontFamily`: `1` (Virgil) | `2` (Helvetica) | `3` (Cascadia)

Per-diagram state (scroll position, selected elements, zoom) stays diagram-local.

**Where to wire this in the frontend?**

A new React context `ExcalidrawSettingsContext` provides the shared settings to every `CanvasView`. Settings are loaded once at the `Workspace` level and pushed down. When a canvas's appState changes, it calls `updateExcalidrawSettings` which persists + re-emits the new values.

---

## Proposed Changes

### Backend — Go

#### [MODIFY] `internal/settings/settings.go`
- Add `ExcalidrawFontFamily int` field to `Config`
- Update `DefaultConfig()` with sensible defaults

#### [MODIFY] `internal/workspace/workspace.go`
Add two new exported methods:
- `GetExcalidrawSettings() (string, error)` — reads `.excalidraw-settings.json` from the local DB (or returns `""` if not found)
- `SaveExcalidrawSettings(content string) error` — writes to local DB + queues a sync operation, mirrors how `SaveDiagram` works but targets the fixed path `.excalidraw-settings.json`

---

### Frontend — React / TypeScript

#### [NEW] `frontend/src/lib/excalidrawSettings.ts`
Defines the `ExcalidrawSharedSettings` type and a `DEFAULT_EXCALIDRAW_SETTINGS` constant.

#### [NEW] `frontend/src/contexts/ExcalidrawSettingsContext.tsx`
React context + hook `useExcalidrawSettings()` that exposes:
- `settings: ExcalidrawSharedSettings`
- `updateSettings: (patch: Partial<ExcalidrawSharedSettings>) => void`

Loaded at the `Workspace` level, persisted via `SaveExcalidrawSettings` on update.

#### [MODIFY] `frontend/src/pages/Workspace.tsx`
- Wrap children in `<ExcalidrawSettingsProvider>` after loading settings from Go backend

#### [MODIFY] `frontend/src/pages/CanvasView.tsx`
- Replace the local `excalidrawTheme` state with `useExcalidrawSettings()`
- Pass `theme`, `gridSize`, `viewBackgroundColor`, and `currentItemFontFamily` from shared settings
- On `onChange`, detect if visual settings changed and call `updateSettings` for cross-canvas sync

---

## Verification Plan

### Manual Verification
1. Open any diagram → change theme to light → close → open another diagram → confirm it opens in light theme
2. Change font family in one canvas → open a second canvas → confirm font matches
3. Check that `.excalidraw-settings.json` appears in the sync queue and is pushed to GitHub on next sync
4. Confirm `.excalidraw-settings.json` is **not** visible in the sidebar file tree

---

## Notes

- Settings are written back from canvas `onChange` (debounced), but only if the relevant shared fields actually changed — otherwise every element drag would trigger a settings save.
- The `.excalidraw-settings.json` file is dot-prefixed so it is blocked by `validateItemName` intentionally — users should never create it manually. `SaveExcalidrawSettings` bypasses validation and writes it directly (same pattern as `.gitkeep`).
