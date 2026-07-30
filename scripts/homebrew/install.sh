#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "Error: Homebrew is required. Install from https://brew.sh" >&2
  exit 1
fi

echo "==> Adding tap krafterlabs/tap"
brew tap krafterlabs/tap 2>/dev/null || brew tap krafterlabs/tap

echo "==> Installing 0x-excali"
brew install --cask 0x-excali

echo "==> Done. Launch from Applications or run: open -a 0x-excali"
echo "    Update later with: brew upgrade --cask 0x-excali"
