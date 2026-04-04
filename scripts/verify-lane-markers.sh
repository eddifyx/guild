#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/verify-lane-markers.sh /absolute/path/to/guild-<platform>-<version>.zip

Checks packaged artifacts for core voice/mentions runtime markers so we can
prove the tested build actually contains the qualification hooks and live paths.
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

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for lane marker validation" >&2
  exit 1
fi

python3 - "$ARCHIVE_PATH" <<'PY'
import re
import sys
import zipfile

archive_path = sys.argv[1]

required_markers = (
    b"guildchat:mention",
    b"mentioned you in /guildchat",
    b"system_notification_action",
    b"voice:create-transport",
    b"voice:consume",
    b"join_requested",
    b"consumer_ready",
    b"guild:lane-diagnostic",
)

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

    app_asar_bytes = zf.read(app_asar_name)

missing = [marker.decode("utf-8", "replace") for marker in required_markers if marker not in app_asar_bytes]
if missing:
    for marker in missing:
      print(f"ERROR: packaged app.asar is missing marker: {marker}", file=sys.stderr)
    sys.exit(1)

print("Lane marker validation passed:")
print(f"  {archive_path}")
PY
