# 0x-excali

A lightweight desktop app for editing and syncing [Excalidraw](https://excalidraw.com/) diagrams with GitHub repositories.

> 0x-excali is an independent project. It is not affiliated with, endorsed by, or sponsored by Excalidraw.

Built with **Go + Wails** and **React + Vite + TailwindCSS**.

## Features

- **GitHub Auth** — Device Flow login, tokens encrypted locally (AES-256-GCM)
- **Excalidraw Canvas** — Full-featured canvas embedded in-app, style-isolated from app chrome
- **Workspace Sync** — Maps to a GitHub repo; push-then-pull sync keeps remote and local consistent
- **SQLite Cache** — Fast local file tree browsing with offline editing support
- **Search Palette** — `Cmd+K` / `Ctrl+K` to search files, favourites, and recent items
- **Shadcn UI** — Modern, Next.js-style UI components including toasts for sync events

## Installation (macOS)

Download the latest `.dmg` from [Releases](../../releases), open it, and drag **0x-excali** to your Applications folder.

**First launch — Gatekeeper prompt**

Because 0x-excali is not yet notarized through the Mac App Store, macOS may show _"0x-excali can't be opened"_. To allow it:

**Option A — Right-click method (no Terminal needed)**
> Right-click (or Control-click) the app → **Open** → click **Open** in the dialog.

**Option B — Terminal one-liner**
```bash
xattr -dr com.apple.quarantine /Applications/0x-excali.app
```
Then double-click the app normally. You only need to do this once.

## Quick Start

**Prerequisites:** Go 1.21+, Node.js 18+, pnpm, [Wails CLI](https://wails.io/docs/gettingstarted/installation)

```bash
# 1. Clone
git clone https://github.com/yourusername/0x-excali.git && cd 0x-excali

# 2. Set up Git hooks
make setup

# 3. Install frontend deps
cd frontend && pnpm install

# 4. Configure GitHub OAuth
#    → GitHub Settings → Developer Settings → OAuth Apps → New OAuth App
#    → Enable Device Flow, copy the Client ID
#    → Paste it in internal/github/auth.go (ClientID variable)

# 5. Run dev server
make dev
```

## Build

```bash
# Local build
make build

# Optimised macOS arm64 release (obfuscated + compressed)
make production-deploy
```

Output: `build/bin/`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All review threads must be resolved before merge. Update `.version` when your change warrants a release.

## Community & Licensing

| | |
|---|---|
| License | [MIT](LICENSE) |
| Third-party notices | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Code of Conduct | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |
| Security | [SECURITY.md](SECURITY.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
