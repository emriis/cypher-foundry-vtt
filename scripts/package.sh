#!/usr/bin/env bash
set -euo pipefail

output_directory="dist"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest_path="$repository_root/system.json"
output_path="$repository_root/$output_directory"
zip_path="$output_path/system.zip"
release_manifest_path="$output_path/system.json"
staging_path="$(mktemp -d "${TMPDIR:-/tmp}/cypher-package-XXXXXX")"

cleanup() {
  rm -rf "$staging_path"
}
trap cleanup EXIT

required_paths=(
  "system.json"
  "cypher.mjs"
  "module"
  "templates"
  "css"
  "lang"
  "packs"
  "assets"
  "LICENSE.txt"
  "README.md"
)

mkdir -p "$output_path"
rm -f "$zip_path" "$release_manifest_path"

for relative_path in "${required_paths[@]}"; do
  source_path="$repository_root/$relative_path"
  if [[ ! -e "$source_path" ]]; then
    echo "Required release path is missing: $relative_path" >&2
    exit 1
  fi

  destination_path="$staging_path/$relative_path"
  if [[ -d "$source_path" ]]; then
    mkdir -p "$destination_path"
    (
      cd "$source_path"
      find . -type f \
        ! -name "LOCK" \
        ! -name "LOG" \
        ! -name "LOG.old" \
        ! -name "*.log" \
        -print0
    ) | while IFS= read -r -d "" file; do
      relative_file="${file#./}"
      mkdir -p "$(dirname "$destination_path/$relative_file")"
      cp "$source_path/$relative_file" "$destination_path/$relative_file"
    done
  else
    cp "$source_path" "$destination_path"
  fi
done

(
  cd "$staging_path"
  zip -q -r -9 "$zip_path" .
)

cp "$manifest_path" "$release_manifest_path"

if ! unzip -Z1 "$zip_path" | grep -Fxq "system.json"; then
  echo "The package archive must contain system.json at its root." >&2
  exit 1
fi

echo "Created $zip_path and $release_manifest_path."
