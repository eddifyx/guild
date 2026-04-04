#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/validate-windows-update-zip.sh /absolute/path/to/guild-win32-x64-<version>.zip

Checks the packaged Windows update zip for the minimum runtime files that must
exist for startup to succeed after update.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ZIP_PATH="${1:-}"

if [[ -z "$ZIP_PATH" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "ERROR: zip not found: $ZIP_PATH" >&2
  exit 1
fi

if command -v zipinfo >/dev/null 2>&1; then
  ZIP_LIST_CMD=(zipinfo -1 "$ZIP_PATH")
elif command -v unzip >/dev/null 2>&1; then
  ZIP_LIST_CMD=(unzip -Z1 "$ZIP_PATH")
else
  echo "ERROR: neither zipinfo nor unzip is available" >&2
  exit 1
fi

RAW_ZIP_ENTRIES="$("${ZIP_LIST_CMD[@]}")"
ZIP_ENTRIES="$(printf '%s\n' "$RAW_ZIP_ENTRIES" | tr '\\' '/')"

require_entry() {
  local expected="$1"
  if ! grep -Fq "$expected" <<<"$ZIP_ENTRIES"; then
    echo "ERROR: missing required archive entry: $expected" >&2
    return 1
  fi
}

require_prefix() {
  local expected="$1"
  if ! grep -Fq "$expected" <<<"$ZIP_ENTRIES"; then
    echo "ERROR: missing required archive prefix: $expected" >&2
    return 1
  fi
}

require_entry "guild.exe"
require_entry "resources/app.asar"
require_entry "resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
require_prefix "resources/vendor/node_modules/@signalapp/libsignal-client/"
require_prefix "resources/vendor/node_modules/node-gyp-build/"
require_prefix "resources/vendor/node_modules/uuid/"

if command -v python3 >/dev/null 2>&1; then
  python3 - "$ZIP_PATH" <<'PY'
import re
import sys
import zipfile

zip_path = sys.argv[1]

with zipfile.ZipFile(zip_path, "r") as zf:
    app_asar_name = None
    for name in zf.namelist():
        normalized = name.replace("\\", "/")
        if re.search(r"(^|/)resources/app\.asar$", normalized):
            app_asar_name = name
            break

    if not app_asar_name:
        print(
            "ERROR: unable to locate resources/app.asar entry in zip "
            "(expected resources/app.asar or <app>/resources/app.asar)",
            file=sys.stderr,
        )
        sys.exit(1)

    app_asar_bytes = zf.read(app_asar_name)

for expected, message in (
    (b"allocateDeviceId", "ERROR: packaged app.asar is missing allocateDeviceId in the preload/runtime bundle"),
    (b"signal:allocate-device-id", "ERROR: packaged app.asar is missing signal:allocate-device-id in the preload/runtime bundle"),
):
    if expected not in app_asar_bytes:
        print(message, file=sys.stderr)
        sys.exit(1)
PY
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/validate-packaged-runtime.sh" "$ZIP_PATH"

echo "Windows update zip validation passed:"
echo "  $ZIP_PATH"
