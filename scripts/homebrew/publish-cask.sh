#!/usr/bin/env bash
# Publishes the Homebrew cask to the in-repo tap and optionally to a separate tap repository.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TAP_REPO="${HOMEBREW_TAP_REPO:-}"
TAP_BRANCH="${HOMEBREW_TAP_BRANCH:-main}"

"$ROOT/scripts/homebrew/generate-cask.sh"

if [[ -z "$TAP_REPO" ]]; then
  echo "==> Cask generated in homebrew/Casks/0x-excali.rb"
  echo "    Commit and push this repo, or set HOMEBREW_TAP_REPO to sync an external tap."
  exit 0
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Syncing cask to ${TAP_REPO}"
git clone --depth 1 --branch "$TAP_BRANCH" "https://github.com/${TAP_REPO}.git" "$WORKDIR/tap"
mkdir -p "$WORKDIR/tap/Casks"
cp "$ROOT/homebrew/Casks/0x-excali.rb" "$WORKDIR/tap/Casks/0x-excali.rb"

(
  cd "$WORKDIR/tap"
  git add Casks/0x-excali.rb
  if git diff --cached --quiet; then
    echo "==> External tap already up to date"
    exit 0
  fi
  git commit -m "Update 0x-excali cask to $(tr -d '[:space:]' < "$ROOT/.version")"
  git push origin "$TAP_BRANCH"
)

echo "==> Published to https://github.com/${TAP_REPO}"
