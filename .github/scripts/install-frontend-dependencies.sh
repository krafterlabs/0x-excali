#!/usr/bin/env bash

set -Eeuo pipefail

frontend_directory="${1:-frontend}"
package_json="${frontend_directory}/package.json"
workspace_file=""

workspace_has_packages() {
  local file="$1"

  awk '
    /^[[:space:]]*packages:[[:space:]]*\[/ {
      if ($0 !~ /\[[[:space:]]*\]/) found = 1
    }
    /^[[:space:]]*packages:[[:space:]]*[^[:space:]\[]/ {
      found = 1
    }
    /^[[:space:]]*packages:[[:space:]]*$/ {
      in_packages = 1
      next
    }
    in_packages && /^[^[:space:]]/ {
      in_packages = 0
    }
    in_packages && /^[[:space:]]*-[[:space:]]*.+/ {
      found = 1
    }
    END {
      exit found ? 0 : 1
    }
  ' "${file}"
}

uses_workspace_protocol() {
  grep -Eq '"workspace:' "${package_json}"
}

if [[ ! -d "${frontend_directory}" ]]; then
  echo "::error::Frontend directory not found: ${frontend_directory}"
  exit 1
fi

if [[ ! -f "${package_json}" ]]; then
  echo "::error::Frontend package.json not found: ${package_json}"
  exit 1
fi

if [[ -f "pnpm-workspace.yaml" ]]; then
  workspace_file="pnpm-workspace.yaml"
elif [[ -f "${frontend_directory}/pnpm-workspace.yaml" ]]; then
  workspace_file="${frontend_directory}/pnpm-workspace.yaml"
fi

if [[ -n "${workspace_file}" ]] && workspace_has_packages "${workspace_file}"; then
  if [[ "${workspace_file}" == "pnpm-workspace.yaml" ]]; then
    pnpm install \
      --frozen-lockfile \
      --prefer-offline \
      --filter "./${frontend_directory}" \
      --fail-if-no-match
  else
    pnpm install \
      --dir "${frontend_directory}" \
      --frozen-lockfile \
      --prefer-offline
  fi
  exit 0
fi

if [[ -n "${workspace_file}" ]] && uses_workspace_protocol; then
  echo "::error::${workspace_file} has no packages, but ${package_json} uses workspace dependencies"
  exit 1
fi

pnpm install \
  --dir "${frontend_directory}" \
  --frozen-lockfile \
  --prefer-offline \
  --ignore-workspace
