# Homebrew distribution (macOS)

Users install from the **`krafterlabs/homebrew-tap`** repository.

## Install

```bash
brew tap krafterlabs/tap
brew install --cask 0x-excali
```

## Update

```bash
brew upgrade --cask 0x-excali
```

## Maintainer: publish after a GitHub release

When a release is **published** (not draft), CI runs `publish-homebrew.yml` automatically.

Manual run:

```bash
./scripts/homebrew/publish-cask.sh
```

Requires `HOMEBREW_TAP_TOKEN` (or `GITHUB_TOKEN` with write access to `krafterlabs/homebrew-tap`).

## Tap repository setup (one-time)

Create `https://github.com/krafterlabs/homebrew-tap` as a public repo. The publish script creates `Casks/0x-excali.rb` and a README on first run.

## Asset naming

CI must upload:

`0x-excali-production-macOS-universal-vX.Y.Z.dmg`

Tag must match `.version` (e.g. `v1.0.5`).
