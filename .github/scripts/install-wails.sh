#!/usr/bin/env bash

set -Eeuo pipefail

mode="${1:---install}"

resolve_version() {
  go list -m -f '{{.Version}}' github.com/wailsapp/wails/v2
}

wails_version="$(resolve_version)"

if [[ -z "${wails_version}" ]]; then
  echo "::error::Wails dependency was not found in go.mod"
  exit 1
fi

go_bin="$(go env GOPATH)/bin"
mkdir -p "${go_bin}"
export PATH="${go_bin}:${PATH}"

case "${mode}" in
  --print-version)
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      printf 'version=%s\n' "${wails_version}" >> "${GITHUB_OUTPUT}"
    else
      printf '%s\n' "${wails_version}"
    fi
    ;;
  --verify)
    command -v wails >/dev/null 2>&1 || {
      echo "::error::Wails executable is unavailable"
      exit 1
    }
    wails version
    ;;
  --install)
    go install "github.com/wailsapp/wails/v2/cmd/wails@${wails_version}"
    command -v wails >/dev/null 2>&1 || {
      echo "::error::Wails executable is unavailable after installation"
      exit 1
    }
    wails version
    ;;
  *)
    echo "::error::Unknown mode: ${mode}"
    exit 1
    ;;
esac
