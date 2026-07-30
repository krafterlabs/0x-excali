#!/usr/bin/env bash
# Publishes the Homebrew cask to krafterlabs/homebrew-tap (override with HOMEBREW_TAP_REPO).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TAP_REPO="${HOMEBREW_TAP_REPO:-krafterlabs/homebrew-tap}"
TAP_BRANCH="${HOMEBREW_TAP_BRANCH:-main}"
GIT_TOKEN="${HOMEBREW_TAP_TOKEN:-${GITHUB_TOKEN:-}}"

"$ROOT/scripts/homebrew/generate-cask.sh"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Syncing cask to ${TAP_REPO}"
if [[ -n "$GIT_TOKEN" ]]; then
  git clone --depth 1 --branch "$TAP_BRANCH" \
    "https://x-access-token:${GIT_TOKEN}@github.com/${TAP_REPO}.git" \
    "$WORKDIR/tap" 2>/dev/null || \
  git clone --depth 1 \
    "https://x-access-token:${GIT_TOKEN}@github.com/${TAP_REPO}.git" \
    "$WORKDIR/tap"
else
  git clone --depth 1 --branch "$TAP_BRANCH" "https://github.com/${TAP_REPO}.git" "$WORKDIR/tap" 2>/dev/null || \
  git clone --depth 1 "https://github.com/${TAP_REPO}.git" "$WORKDIR/tap"
fi

mkdir -p "$WORKDIR/tap/Casks"
cp "$ROOT/homebrew/Casks/0x-excali.rb" "$WORKDIR/tap/Casks/0x-excali.rb"

(
  cd "$WORKDIR/tap"
  if [[ ! -f README.md ]]; then
    cat > README.md <<'EOF'
# krafterlabs Homebrew tap

```bash
brew tap krafterlabs/tap
brew install --cask 0x-excali
```

Update: `brew upgrade --cask 0x-excali`
EOF
  fi
  git add Casks/0x-excali.rb README.md
  if git diff --cached --quiet; then
    echo "==> Tap already up to date"
    exit 0
  fi
  git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -m "Update 0x-excali cask to $(tr -d '[:space:]' < "$ROOT/.version")"
  if [[ -n "$GIT_TOKEN" ]]; then
    git push "https://x-access-token:${GIT_TOKEN}@github.com/${TAP_REPO}.git" "HEAD:${TAP_BRANCH}"
  else
    git push origin "$TAP_BRANCH"
  fi
)

echo "==> Published to https://github.com/${TAP_REPO}"
echo "    Install: brew tap krafterlabs/tap && brew install --cask 0x-excali"
