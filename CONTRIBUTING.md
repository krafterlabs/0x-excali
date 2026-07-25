# Contributing to 0x-excali

First off, thank you for considering contributing to 0x-excali!

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/0x-excali.git
   cd 0x-excali
   ```
2. **Install dependencies:**
   ```bash
   make setup
   cd frontend && pnpm install
   ```

## Development

- Start the development server (runs both Go backend and Vite frontend with hot-reloading):
  ```bash
  make dev
  ```
- Build the production application:
  ```bash
  make production-deploy
  ```

## Branch and Pull Request Expectations

- **Scope:** Keep changes small, scoped to a specific feature or fix.
- **Review:** All review threads must be resolved before a pull request can be merged.
- **Testing:** Test your changes locally before submitting a PR.
- **Versioning:** Our CI system validates `.version` file changes. If your PR constitutes a new release, make sure to update the `.version` file accordingly.
- **Artifacts:** Do not commit generated build artifacts (like `build/bin/` or `frontend/dist/`) unless absolutely required.
- **Legal Hygiene:** Do not add new dependencies or binary assets with unclear licenses. Ensure proper legal hygiene.
