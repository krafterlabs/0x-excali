# Homebrew distribution

macOS installs use a **Homebrew cask** that downloads the signed release DMG from GitHub.

## Layout

```
homebrew/
  Casks/
    0x-excali.rb    # generated — do not hand-edit before release
scripts/homebrew/
  generate-cask.sh  # build cask from .version + release checksum
  publish-cask.sh   # generate and optionally push to an external tap
  install.sh        # end-user install via brew
```

## Maintainer: publish a new version

1. Merge `release-vX.Y.Z` to `master` and publish the GitHub release (DMG + `.sha256` must exist).
2. From the repo root:

```bash
chmod +x scripts/homebrew/*.sh
./scripts/homebrew/publish-cask.sh
git add homebrew/Casks/0x-excali.rb
git commit -m "Update Homebrew cask for vX.Y.Z"
```

3. Optional — push to a dedicated tap repo:

```bash
HOMEBREW_TAP_REPO=krafterlabs/homebrew-tap ./scripts/homebrew/publish-cask.sh
```

## User: install from Homebrew

After the cask is committed to `homebrew/` on the default branch:

```bash
curl -fsSL https://raw.githubusercontent.com/krafterlabs/0x-excali/master/scripts/homebrew/install.sh | bash
```

Or manually:

```bash
brew tap krafterlabs/0x-excali https://github.com/krafterlabs/0x-excali homebrew
brew install --cask 0x-excali
```

## Asset naming

The cask expects the macOS universal DMG from CI:

`0x-excali-production-macOS-universal-vX.Y.Z.dmg`

Release tag must match `.version` (e.g. `v1.0.5`).
