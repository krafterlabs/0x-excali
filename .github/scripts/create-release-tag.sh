#!/usr/bin/env bash

set -Eeuo pipefail

version="${1:?Version is required}"
target_sha="${2:?Target SHA is required}"
platform_id="${3:-}"
tag_mode="${4:-platform}"

case "${tag_mode}" in
  platform)
    [[ -n "${platform_id}" ]] || {
      echo "::error::Platform id is required when release-tag-mode is platform"
      exit 1
    }
    tag="${version}-${platform_id}"
    ;;
  single)
    tag="${version}"
    ;;
  *)
    echo "::error::Unsupported release tag mode: ${tag_mode}"
    exit 1
    ;;
esac

if git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1; then
  echo "::error::Tag ${tag} already exists"
  exit 1
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git tag \
  --annotate "${tag}" \
  "${target_sha}" \
  --message "Release ${tag}"

git push origin "refs/tags/${tag}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'tag=%s\n' "${tag}" >> "${GITHUB_OUTPUT}"
else
  printf '%s\n' "${tag}"
fi
