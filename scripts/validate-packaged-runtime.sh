#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/validate-packaged-runtime.sh /absolute/path/to/guild-<platform>-<version>.zip

Checks the packaged app.asar for the runtime-managed files that the main
process expects to find at startup. This catches release artifacts where the
renderer bundle is present but required copied runtime sources are missing.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ARCHIVE_PATH="${1:-}"

if [[ -z "$ARCHIVE_PATH" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "ERROR: archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

PYTHON_BIN="$(command -v python3 || command -v python || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "ERROR: python3 or python is required for packaged runtime validation" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for packaged runtime validation" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ASAR_CLI=""
for candidate in \
  "$ROOT_DIR/client/node_modules/@electron/asar/bin/asar.js" \
  "$ROOT_DIR/node_modules/@electron/asar/bin/asar.js"
do
  if [[ -f "$candidate" ]]; then
    ASAR_CLI="$candidate"
    break
  fi
done

if [[ -z "$ASAR_CLI" ]]; then
  echo "ERROR: unable to locate @electron/asar CLI in node_modules" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
APP_ASAR_PATH="$TMP_DIR/app.asar"

"$PYTHON_BIN" - "$ARCHIVE_PATH" "$APP_ASAR_PATH" <<'PY'
import re
import sys
import zipfile

archive_path = sys.argv[1]
output_path = sys.argv[2]

with zipfile.ZipFile(archive_path, "r") as zf:
    app_asar_name = None
    for name in zf.namelist():
        normalized = name.replace("\\", "/")
        normalized_lower = normalized.lower()
        if re.search(r"(^|/)(contents/)?resources/app\.asar$", normalized_lower):
            app_asar_name = name
            break

    if not app_asar_name:
        print(
            "ERROR: unable to locate app.asar inside archive "
            "(expected resources/app.asar or .app/Contents/Resources/app.asar)",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(output_path, "wb") as out_file:
        out_file.write(zf.read(app_asar_name))
PY

ASAR_LIST="$(node "$ASAR_CLI" list "$APP_ASAR_PATH")"

require_asar_entry() {
  local expected="$1"
  if ! grep -Fxq "$expected" <<<"$ASAR_LIST"; then
    echo "ERROR: packaged app.asar is missing required runtime entry: $expected" >&2
    return 1
  fi
}

require_asar_entry "/package.json"
require_asar_entry "/.vite/build/main.js"
require_asar_entry "/.vite/build/preload.js"
require_asar_entry "/.vite/renderer/main_window/index.html"
require_asar_entry "/config/appFlavor.js"
require_asar_entry "/electron/crypto/signalBridge.js"
require_asar_entry "/electron/crypto/runtimeModules.js"
require_asar_entry "/electron/crypto/signalStore.js"
require_asar_entry "/electron/crypto/signalStoreMemory.js"

echo "Packaged runtime validation passed:"
echo "  $ARCHIVE_PATH"
