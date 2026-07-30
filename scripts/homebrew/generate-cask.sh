#!/usr/bin/env bash
# Generates homebrew/Casks/0x-excali.rb from .version and the GitHub release DMG checksum.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION_FILE="${VERSION_FILE:-$ROOT/.version}"
CASK_PATH="${CASK_PATH:-$ROOT/homebrew/Casks/0x-excali.rb}"
GITHUB_REPO="${GITHUB_REPO:-krafterlabs/0x-excali}"

VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ -z "$VERSION" ]]; then
  echo "Error: .version is empty" >&2
  exit 1
fi

VERSION_TAG="$VERSION"
if [[ "$VERSION_TAG" != v* ]]; then
  VERSION_TAG="v${VERSION_TAG}"
fi

CASK_VERSION="${VERSION_TAG#v}"
DMG_NAME="0x-excali-production-macOS-universal-${VERSION_TAG}.dmg"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION_TAG}/${DMG_NAME}"
CHECKSUM_URL="${DOWNLOAD_URL}.sha256"

echo "==> Fetching SHA256 from ${CHECKSUM_URL}"
SHA256=""
if curl -fsSL "$CHECKSUM_URL" 2>/dev/null | awk '{print $1}' | grep -E '^[a-f0-9]{64}$' >/tmp/0x-excali-sha256; then
  SHA256="$(cat /tmp/0x-excali-sha256)"
fi

if [[ -z "$SHA256" ]]; then
  echo "==> Checksum file missing; computing SHA256 from DMG"
  TMP_DMG="$(mktemp -t 0x-excali-dmg.XXXXXX)"
  trap 'rm -f "$TMP_DMG" /tmp/0x-excali-sha256' EXIT
  curl -fsSL -o "$TMP_DMG" "$DOWNLOAD_URL"
  SHA256="$(shasum -a 256 "$TMP_DMG" | awk '{print $1}')"
fi

if [[ -z "$SHA256" || ${#SHA256} -ne 64 ]]; then
  echo "Error: Could not resolve SHA256 for ${VERSION_TAG}. Publish the GitHub release first." >&2
  exit 1
fi

mkdir -p "$(dirname "$CASK_PATH")"
cat > "$CASK_PATH" <<RUBY
cask "0x-excali" do
  version "${CASK_VERSION}"
  sha256 "${SHA256}"

  url "${DOWNLOAD_URL}"
  name "0x-excali"
  desc "Local-first visual workspace for diagrams with optional GitHub sync"
  homepage "https://github.com/${GITHUB_REPO}"

  app "0x-excali.app"

  zap trash: [
    "~/Library/Application Support/0x-excali",
    "~/Library/Preferences/com.wails.0x-excali.plist",
    "~/Library/Saved Application State/com.wails.0x-excali.savedState",
  ]
end
RUBY

echo "==> Wrote ${CASK_PATH}"
