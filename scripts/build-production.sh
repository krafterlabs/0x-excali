#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  echo "Usage: $0 --target <macos|linux> --arch <arm64|amd64|universal> --package <dmg|zip|tar.gz|appimage|none> [--secure] [--skip-frontend-install] [--skip-frontend-build] [--version-file <file>]"
}

log() {
  echo -e "\033[1;34m==>\033[0m $*"
}

fail() {
  echo -e "\033[1;31mError:\033[0m $*" >&2
  exit 1
}

# Defaults
APP_NAME="0x-excali"
VERSION_FILE=".version"
FRONTEND_DIR="frontend"
BUILD_DIR="build/bin"
TARGET=""
ARCH=""
PACKAGE=""
SECURE="false"
SKIP_FRONTEND_INSTALL="false"
SKIP_FRONTEND_BUILD="false"

VERSION=""
FINAL_ASSET_PATH=""
METADATA_PATH=""
CHECKSUM_PATH=""

parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case $1 in
      --target) TARGET="$2"; shift ;;
      --arch) ARCH="$2"; shift ;;
      --package) PACKAGE="$2"; shift ;;
      --secure) SECURE="true" ;;
      --skip-frontend-install) SKIP_FRONTEND_INSTALL="true" ;;
      --skip-frontend-build) SKIP_FRONTEND_BUILD="true" ;;
      --version-file) VERSION_FILE="$2"; shift ;;
      *) usage; fail "Unknown parameter passed: $1" ;;
    esac
    shift
  done

  if [[ -z "$TARGET" || -z "$PACKAGE" ]]; then
    usage
    fail "--target and --package are required."
  fi
  
  if [[ -z "$ARCH" ]]; then
    if [[ "$TARGET" == "macos" ]]; then
      ARCH="universal"
    else
      ARCH="amd64"
    fi
  fi
}

detect_host() {
  local host_os
  host_os="$(uname -s | tr '[:upper:]' '[:lower:]')"

  if [[ "$TARGET" == "linux" && "$host_os" == "darwin" ]]; then
    fail "Linux production builds should run on Linux, such as ubuntu-22.04 in GitHub Actions."
  fi

  if [[ "$TARGET" == "macos" && "$host_os" == "linux" ]]; then
    fail "macOS production builds should run on macOS, such as macos-latest in GitHub Actions."
  fi
}

validate_prerequisites() {
  for f in "go.mod" "wails.json" "$VERSION_FILE" "$FRONTEND_DIR/package.json" "$FRONTEND_DIR/pnpm-lock.yaml"; do
    if [[ ! -f "$f" ]]; then
      fail "Required file $f not found. Are you running this from the repository root?"
    fi
  done

  command -v pnpm >/dev/null 2>&1 || fail "pnpm is required but not installed."
  command -v wails >/dev/null 2>&1 || fail "wails is required but not installed."
  command -v go >/dev/null 2>&1 || fail "go is required but not installed."
  command -v node >/dev/null 2>&1 || fail "node is required but not installed."
}

secure_preflight() {
  if [[ "$SECURE" == "true" ]]; then
    log "Running secure preflight checks..."
    
    # 1. Verify Go version matches go.mod exactly
    local required_go
    required_go=$(grep -E '^go [0-9]+\.[0-9]+\.[0-9]+' go.mod | awk '{print $2}')
    local current_go
    current_go=$(go version | awk '{print $3}' | sed 's/go//')
    if [[ "$current_go" != "$required_go" ]]; then
      fail "Go version mismatch! Required: $required_go, Found: $current_go"
    fi
    
    # 2. Verify Node version matches .nvmrc exactly
    if [[ -f ".nvmrc" ]]; then
      local required_node
      required_node=$(cat .nvmrc | tr -d 'v\n')
      local current_node
      current_node=$(node --version | tr -d 'v\n')
      if [[ "$current_node" != "$required_node"* ]]; then
        fail "Node version mismatch! Required: $required_node, Found: $current_node"
      fi
    fi
    
    # 3. Verify pnpm version matches package.json packageManager
    local required_pnpm
    required_pnpm=$(grep -E '"packageManager": *"pnpm@.*"' "$FRONTEND_DIR/package.json" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
    if [[ -n "$required_pnpm" ]]; then
      local current_pnpm
      current_pnpm=$(pnpm --version)
      if [[ "$current_pnpm" != "$required_pnpm" ]]; then
        fail "pnpm version mismatch! Required: $required_pnpm, Found: $current_pnpm"
      fi
    fi
    
    # 4. Verify Wails CLI version matches go.mod
    local required_wails
    required_wails=$(grep -E 'github.com/wailsapp/wails/v2' go.mod | head -n1 | awk '{print $2}' | tr -d 'v')
    local current_wails
    current_wails=$(wails version | grep -E 'v[0-9]+\.[0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
    if [[ "$current_wails" != "$required_wails" ]]; then
      fail "Wails CLI version mismatch! Required: $required_wails, Found: $current_wails"
    fi
    
    log "Toolchain versions verified."
    
    log "Verifying go modules..."
    go mod verify
    
    log "Running tests..."
    go test ./...
    
    # Snapshot checksums of lockfiles
    PREFLIGHT_GOSUM=$(shasum -a 256 go.sum | awk '{print $1}')
    PREFLIGHT_PNPMLOCK=$(shasum -a 256 "$FRONTEND_DIR/pnpm-lock.yaml" | awk '{print $1}')
  fi
}

secure_postflight() {
  if [[ "$SECURE" == "true" ]]; then
    log "Running secure postflight checks..."
    local post_gosum
    post_gosum=$(shasum -a 256 go.sum | awk '{print $1}')
    local post_pnpmlock
    post_pnpmlock=$(shasum -a 256 "$FRONTEND_DIR/pnpm-lock.yaml" | awk '{print $1}')
    
    if [[ "$PREFLIGHT_GOSUM" != "$post_gosum" ]]; then
      fail "go.sum was modified during the build! The build is not deterministic."
    fi
    
    if [[ "$PREFLIGHT_PNPMLOCK" != "$post_pnpmlock" ]]; then
      fail "pnpm-lock.yaml was modified during the build! The build is not deterministic."
    fi
    log "Deterministic build verified."
  fi
}

read_version() {
  VERSION="$(cat "$VERSION_FILE")"
  if [[ ! "$VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    fail "Version '$VERSION' in $VERSION_FILE is not SemVer-like."
  fi
  if [[ ! "$VERSION" == v* ]]; then
    VERSION="v$VERSION"
  fi
}

print_tool_versions() {
  log "Build Environment"
  go version
  node --version
  echo "pnpm $(pnpm --version)"
  wails version
}

install_frontend_dependencies() {
  if [[ "$SKIP_FRONTEND_INSTALL" == "false" ]]; then
    log "Installing frontend dependencies..."
    if [[ "$SECURE" == "true" ]]; then
      (cd "$FRONTEND_DIR" && pnpm install --frozen-lockfile --prefer-offline)
    else
      (cd "$FRONTEND_DIR" && pnpm install)
    fi
  fi
}

build_frontend() {
  if [[ "$SKIP_FRONTEND_BUILD" == "false" ]]; then
    log "Building frontend..."
    (cd "$FRONTEND_DIR" && pnpm run build)
  fi
}

package_macos_dmg() {
  local app_path="${BUILD_DIR}/${APP_NAME}.app"
  if [[ ! -d "$app_path" ]]; then
    fail "Expected app bundle at $app_path not found."
  fi
  
  local icns_path="${BUILD_DIR}/iconfile.icns"
  local logo_path="frontend/public/logo.png"

  if [[ -f "$logo_path" ]]; then
    log "Generating macOS iconfile.icns from $logo_path..."
    mkdir -p "${BUILD_DIR}/icon.iconset"
    sips -z 16 16     "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_16x16.png" > /dev/null
    sips -z 32 32     "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_16x16@2x.png" > /dev/null
    sips -z 32 32     "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_32x32.png" > /dev/null
    sips -z 64 64     "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_32x32@2x.png" > /dev/null
    sips -z 128 128   "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_128x128.png" > /dev/null
    sips -z 256 256   "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_128x128@2x.png" > /dev/null
    sips -z 256 256   "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_256x256.png" > /dev/null
    sips -z 512 512   "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_256x256@2x.png" > /dev/null
    sips -z 512 512   "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_512x512.png" > /dev/null
    sips -z 1024 1024 "$logo_path" --out "${BUILD_DIR}/icon.iconset/icon_512x512@2x.png" > /dev/null
    iconutil -c icns "${BUILD_DIR}/icon.iconset" -o "$icns_path"
    rm -rf "${BUILD_DIR}/icon.iconset"
    
    # Overwrite the app icon
    cp "$icns_path" "$app_path/Contents/Resources/iconfile.icns"
  fi
  
  local dmg_path="${BUILD_DIR}/${APP_NAME}-production-macOS-${ARCH}-${VERSION}.dmg"
  rm -f "$dmg_path"
  log "Creating DMG..."
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$app_path" \
    -ov \
    -format UDZO \
    "$dmg_path" > /dev/null
    
  FINAL_ASSET_PATH="$dmg_path"
}

package_linux_tarball() {
  local bin_path="${BUILD_DIR}/${APP_NAME}"
  if [[ ! -f "$bin_path" ]]; then
    fail "Expected binary at $bin_path not found."
  fi
  
  local tar_path="${BUILD_DIR}/${APP_NAME}-production-linux-${ARCH}-${VERSION}.tar.gz"
  rm -f "$tar_path"
  log "Creating Tarball..."
  (cd "$BUILD_DIR" && tar -czf "$(basename "$tar_path")" "$(basename "$bin_path")")
  
  FINAL_ASSET_PATH="$tar_path"
}

build_wails() {
  log "Running Wails production build for $TARGET..."
  if [[ "$TARGET" == "macos" ]]; then
    wails build -platform "darwin/${ARCH}" -clean -m -s -trimpath -ldflags="-s -w"
    
    if [[ "$PACKAGE" == "dmg" ]]; then
      package_macos_dmg
    fi
    
  elif [[ "$TARGET" == "linux" ]]; then
    local wails_cmd=(wails build -platform "linux/${ARCH}" -clean -m -s -trimpath -ldflags="-s -w")
    
    if [[ -n "${WAILS_LINUX_TAGS:-}" ]]; then
      wails_cmd+=(-tags "${WAILS_LINUX_TAGS}")
    fi
    
    "${wails_cmd[@]}"
    
    if [[ "$PACKAGE" == "tar.gz" ]]; then
      package_linux_tarball
    fi
  fi
}

generate_artifacts() {
  if [[ -n "$FINAL_ASSET_PATH" && -f "$FINAL_ASSET_PATH" ]]; then
    log "Generating checksum and metadata..."
    
    # Generate SHA256 checksum
    CHECKSUM_PATH="${FINAL_ASSET_PATH}.sha256"
    (cd "$(dirname "$FINAL_ASSET_PATH")" && shasum -a 256 "$(basename "$FINAL_ASSET_PATH")" > "$(basename "$CHECKSUM_PATH")")
    
    # Generate Build Metadata JSON
    METADATA_PATH="${FINAL_ASSET_PATH%.*}-metadata.json"
    cat <<JSON > "$METADATA_PATH"
{
  "app_name": "$APP_NAME",
  "version": "$VERSION",
  "target": "$TARGET",
  "arch": "$ARCH",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "build_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "go_version": "$(go version | awk '{print $3}')",
  "node_version": "$(node --version)",
  "pnpm_version": "$(pnpm --version)",
  "wails_version": "$(wails version | grep -E 'v[0-9]+\.[0-9]+\.[0-9]+' | head -n1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo 'unknown')"
}
JSON
  fi
}

print_summary() {
  echo ""
  echo "Production build complete"
  echo "Target: $TARGET"
  echo "Version: $VERSION"
  
  if [[ "$TARGET" == "macos" ]]; then
    echo "App: ${BUILD_DIR}/${APP_NAME}.app"
  elif [[ "$TARGET" == "linux" ]]; then
    echo "Binary: ${BUILD_DIR}/${APP_NAME}"
  fi
  
  if [[ -n "$FINAL_ASSET_PATH" ]]; then
    echo "Asset: $FINAL_ASSET_PATH"
    echo "Checksum: $CHECKSUM_PATH"
    echo "Metadata: $METADATA_PATH"
  fi
  
  if [[ -n "${GITHUB_OUTPUT:-}" && -n "$FINAL_ASSET_PATH" ]]; then
    echo "target=$TARGET" >> "$GITHUB_OUTPUT"
    echo "version=$VERSION" >> "$GITHUB_OUTPUT"
    echo "asset_path=$FINAL_ASSET_PATH" >> "$GITHUB_OUTPUT"
    echo "asset_name=$(basename "$FINAL_ASSET_PATH")" >> "$GITHUB_OUTPUT"
    echo "checksum_path=$CHECKSUM_PATH" >> "$GITHUB_OUTPUT"
    echo "metadata_path=$METADATA_PATH" >> "$GITHUB_OUTPUT"
  fi
}

main() {
  parse_args "$@"
  detect_host
  validate_prerequisites
  secure_preflight
  read_version
  print_tool_versions
  install_frontend_dependencies
  build_frontend
  build_wails
  secure_postflight
  generate_artifacts
  print_summary
}

main "$@"
