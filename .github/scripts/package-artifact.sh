#!/usr/bin/env bash

set -Eeuo pipefail

app_name="${1:?App name is required}"
environment_name="${2:?Environment name is required}"
version="${3:?Version is required}"
platform_id="${4:?Platform id is required}"
artifact_platform="${5:?Artifact platform is required}"
artifact_path="${6:?Artifact path is required}"
archive_format="${7:-zip}"

archive_name="${app_name}-${environment_name}-${artifact_platform}-${version}.zip"
archive_directory="$(dirname "${artifact_path}")"
archive_path="${archive_directory}/${archive_name}"

if [[ ! -e "${artifact_path}" ]]; then
  echo "::error::Artifact not found for ${platform_id}: ${artifact_path}"
  exit 1
fi

mkdir -p "${archive_directory}"
rm -f "${archive_path}"

create_zip() {
  if command -v ditto >/dev/null 2>&1; then
    ditto -c -k --sequesterRsrc --keepParent "${artifact_path}" "${archive_path}"
    return
  fi

  local parent
  local name
  parent="$(dirname "${artifact_path}")"
  name="$(basename "${artifact_path}")"

  if command -v zip >/dev/null 2>&1; then
    (
      cd "${parent}"
      zip -qry "${archive_path}" "${name}"
    )
    return
  fi

  if command -v 7z >/dev/null 2>&1; then
    7z a -tzip "${archive_path}" "${artifact_path}" >/dev/null
    return
  fi

  echo "::error::No ZIP tool found"
  exit 1
}

create_tar_gz() {
  local parent
  local name
  parent="$(dirname "${artifact_path}")"
  name="$(basename "${artifact_path}")"
  archive_name="${app_name}-${environment_name}-${artifact_platform}-${version}.tar.gz"
  archive_path="${archive_directory}/${archive_name}"
  rm -f "${archive_path}"
  tar -C "${parent}" -czf "${archive_path}" "${name}"
}

create_dmg() {
  if [[ "${artifact_path}" != *.app ]]; then
    echo "::error::DMG packaging requires a macOS .app bundle: ${artifact_path}"
    exit 1
  fi

  if ! command -v hdiutil >/dev/null 2>&1; then
    echo "::error::hdiutil is required to create a DMG"
    exit 1
  fi

  local staging_directory
  local dmg_name
  local dmg_path
  local app_bundle_name

  staging_directory="$(mktemp -d)"
  dmg_name="${app_name}-${environment_name}-${artifact_platform}-${version}.dmg"
  dmg_path="${archive_directory}/${dmg_name}"
  app_bundle_name="$(basename "${artifact_path}")"

  rm -f "${dmg_path}"
  cp -R "${artifact_path}" "${staging_directory}/${app_bundle_name}"
  ln -s /Applications "${staging_directory}/Applications"

  if [[ -f "THIRD_PARTY_NOTICES.md" ]]; then
    cp "THIRD_PARTY_NOTICES.md" "${staging_directory}/"
  fi
  if [[ -f "LICENSE" ]]; then
    cp "LICENSE" "${staging_directory}/"
  fi

  hdiutil create \
    -volname "${app_name}" \
    -srcfolder "${staging_directory}" \
    -ov \
    -format UDZO \
    "${dmg_path}"

  rm -rf "${staging_directory}"

  archive_name="${dmg_name}"
  archive_path="${dmg_path}"
}

case "${archive_format}" in
  zip)
    create_zip
    ;;
  dmg)
    create_dmg
    ;;
  tar.gz)
    create_tar_gz
    ;;
  none)
    archive_name="$(basename "${artifact_path}")"
    archive_path="${artifact_path}"
    ;;
  *)
    echo "::error::Unsupported archive format: ${archive_format}"
    exit 1
    ;;
esac

if [[ ! -f "${archive_path}" ]]; then
  echo "::error::Packaged file was not created: ${archive_path}"
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'name=%s\n' "${archive_name}" >> "${GITHUB_OUTPUT}"
  printf 'path=%s\n' "${archive_path}" >> "${GITHUB_OUTPUT}"
else
  printf '%s\n' "${archive_path}"
fi
