# 0x-excali

0x-excali is a lightweight, cross-platform desktop application designed to synchronize and manage [Excalidraw](https://excalidraw.com/) diagrams directly with your GitHub repositories. 

By linking local workspaces to GitHub, you can seamlessly edit your `.excalidraw` files locally with a built-in canvas and sync them back to the cloud, allowing you to use GitHub as a decentralized storage solution for your diagrams.

Built with **Go (Wails)** for a lightweight, secure backend and **React (Vite + TailwindCSS + Shadcn UI)** for a beautiful, modern frontend.

## Features

- **GitHub Device Flow Authentication:** Securely log in using your GitHub account without exposing client secrets or relying on web callbacks. Tokens are encrypted locally (AES-256-GCM).
- **Excalidraw Integration:** Full-featured Excalidraw canvas embedded directly in the app. App chrome (header, sidebar, breadcrumbs) stays outside the canvas and app styles are isolated from Excalidraw's internals.
- **Workspace Management:** Each workspace maps to a GitHub repository; the file tree is cached locally in SQLite for fast browsing and offline editing.
- **Explicit Sync:** No background polling. Sync runs **at app startup and on manual trigger** only, and always **pushes queued local changes first, then pulls** the remote tree — so deletes and edits are committed before the pull and never resurrected. See [Sync behavior](#sync-behavior).
- **Beautiful UI:** Styled with Shadcn UI, featuring a dynamic dark mode based on high-contrast OKLCH CSS variables.

## Sync behavior

- **When it runs:** on app startup and when you click **Sync Changes** (or the header sync icon). There is no periodic background sync.
- **Order:** push-then-pull. Local creates/updates/deletes are queued as you work, flushed to GitHub on sync, and only then is the remote tree pulled back into the local cache.
- **Commits:** each queued file operation is a commit via the GitHub Contents API, using the message `"<ISO-timestamp> — <N> file(s) changed"` for the batch. (One commit per file; true single-commit batching would require the Git Trees API.)
- **Folders:** GitHub has no folder objects, so deleting a folder deletes every file under it; empty folders are represented by a `.gitkeep` placeholder.
- **Offline:** edits are saved locally and queued; the queue flushes on the next sync.

## Getting Started / How to Build

### Prerequisites
- [Go 1.21+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/0x-excali.git
   cd 0x-excali
   ```

2. **Configure your GitHub OAuth App:**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers) -> OAuth Apps -> New OAuth App.
   - Name: `0x-excali` (or any preferred name).
   - Homepage URL: `https://github.com`.
   - Authorization callback URL: `http://localhost` (not used by device flow but required by GitHub).
   - Ensure you check **"Enable Device Flow"**.
   - Copy the Client ID.
   - Open `internal/github/auth.go` and replace the `ClientID` variable with your new Client ID.

3. **Run the Development Server:**
   ```bash
   make dev
   # or
   wails dev
   ```
   This will start both the Go backend and the Vite frontend server with hot-reloading enabled.

### Building for Production

To compile a standalone executable for your operating system:

```bash
wails build
```
The compiled binary will be placed in the `build/bin/` directory.

## How to Contribute

Contributions are highly welcome! To contribute:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please refer to the `docs/architecture.md` file for an overview of the codebase to help you get oriented before making architectural changes.
