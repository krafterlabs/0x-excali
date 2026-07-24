#!/usr/bin/env bash

set -Eeuo pipefail

version_file="${1:-.version}"

if [[ ! -f "${version_file}" ]]; then
  echo "::error::Version file not found: ${version_file}"
  exit 1
fi

version="$(tr -d '[:space:]' < "${version_file}")"

if [[ -z "${version}" ]]; then
  echo "::error::Version is empty"
  exit 1
fi

if [[ ! "${version}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::Invalid version: ${version}"
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'value=%s\n' "${version}" >> "${GITHUB_OUTPUT}"
else
  printf '%s\n' "${version}"
fi
