#!/usr/bin/env bash
# Installs 0x-excali from the Homebrew tap in this repository.
set -Eeuo pipefail

TAP_OWNER="${HOMEBREW_TAP_OWNER:-krafterlabs}"
TAP_NAME="${HOMEBREW_TAP_NAME:-0x-excali}"
TAP_URL="${HOMEBREW_TAP_URL:-https://github.com/krafterlabs/0x-excali}"
TAP_PATH="${HOMEBREW_TAP_PATH:-homebrew}"

if ! command -v brew >/dev/null 2>&1; then
  echo "Error: Homebrew is required. Install from https://brew.sh" >&2
  exit 1
fi

echo "==> Adding tap ${TAP_OWNER}/${TAP_NAME}"
if brew tap | grep -q "^${TAP_OWNER}/${TAP_NAME}$"; then
  brew untap "${TAP_OWNER}/${TAP_NAME}" 2>/dev/null || true
fi
brew tap "${TAP_OWNER}/${TAP_NAME}" "$TAP_URL" "$TAP_PATH"

echo "==> Installing 0x-excali"
brew install --cask 0x-excali

echo "==> Done. Launch 0x-excali from Applications or run: open -a 0x-excali"
