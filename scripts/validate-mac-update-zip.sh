#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/validate-mac-update-zip.sh /absolute/path/to/guild-darwin-arm64-<version>.zip

Checks the packaged macOS update zip for archive hygiene and the minimum runtime
markers we rely on for startup/update safety.
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

if grep -Eq '(^__MACOSX/|/\._|^\._)' <<<"$ZIP_ENTRIES"; then
  echo "ERROR: mac update zip contains AppleDouble metadata (__MACOSX or ._ entries)" >&2
  exit 1
fi

require_entry() {
  local expected="$1"
  if ! grep -Fq "$expected" <<<"$ZIP_ENTRIES"; then
    echo "ERROR: missing required archive entry: $expected" >&2
    return 1
  fi
}

require_entry "guild.app/Contents/Resources/app.asar"
require_entry "guild.app/Contents/Info.plist"

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
        if re.fullmatch(r"guild\.app/Contents/Resources/app\.asar", normalized):
            app_asar_name = name
            break

    if not app_asar_name:
        print("ERROR: unable to locate guild.app/Contents/Resources/app.asar in zip", file=sys.stderr)
        sys.exit(1)

    app_asar_bytes = zf.read(app_asar_name)

for expected, message in (
    (b"messages:reload-ready", "ERROR: packaged app.asar is missing messages:reload-ready in the renderer bundle"),
    (b"signal:allocate-device-id", "ERROR: packaged app.asar is missing signal:allocate-device-id in the preload/runtime bundle"),
):
    if expected not in app_asar_bytes:
        print(message, file=sys.stderr)
        sys.exit(1)
PY
fi

if command -v mktemp >/dev/null 2>&1 && command -v unzip >/dev/null 2>&1; then
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  unzip -qq "$ZIP_PATH" -d "$TMP_DIR"

  APP_PATH="$TMP_DIR/guild.app"
  if [[ ! -d "$APP_PATH" ]]; then
    echo "ERROR: extracted app missing at $APP_PATH" >&2
    exit 1
  fi

  if command -v codesign >/dev/null 2>&1; then
    codesign --verify --deep --strict "$APP_PATH"
  fi
  if command -v spctl >/dev/null 2>&1; then
    spctl -a -vv "$APP_PATH"
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/validate-packaged-runtime.sh" "$ZIP_PATH"

echo "Mac update zip validation passed:"
echo "  $ZIP_PATH"
