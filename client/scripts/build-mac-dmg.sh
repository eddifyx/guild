#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NODE_RUNNER="$(command -v node || true)"

if [[ -z "$NODE_RUNNER" ]]; then
  ELECTRON_NODE="$CLIENT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
  if [[ -x "$ELECTRON_NODE" ]]; then
    NODE_RUNNER="$ELECTRON_NODE"
    export ELECTRON_RUN_AS_NODE=1
  fi
fi

if [[ -z "$NODE_RUNNER" ]]; then
  echo "No Node-compatible runtime found for flavor resolution" >&2
  exit 1
fi

read -r DEFAULT_PACKAGE_DIR DEFAULT_APP_BUNDLE DEFAULT_BACKGROUND_PATH DEFAULT_ICON_PATH <<EOF
$("$NODE_RUNNER" - "$CLIENT_DIR" <<'NODE'
const path = require('path');
const clientDir = process.argv[2];
const { getAppFlavor, resolveFlavorAsset } = require(path.join(clientDir, 'config', 'appFlavor.js'));
const flavor = getAppFlavor(process.env.GUILD_APP_FLAVOR);

process.stdout.write([
  `${flavor.packageDirName}-darwin-arm64`,
  flavor.appBundleName,
  resolveFlavorAsset(clientDir, flavor, 'dmg-background', '.png'),
  resolveFlavorAsset(clientDir, flavor, 'icon', '.icns'),
].join('\t'));
NODE
)
EOF

APP_PATH="$CLIENT_DIR/out/$DEFAULT_PACKAGE_DIR/$DEFAULT_APP_BUNDLE"
OUTPUT_PATH=""
VOLUME_NAME=""
BACKGROUND_PATH="$DEFAULT_BACKGROUND_PATH"
APPLICATIONS_PATH="/Applications"
ICON_PATH="$DEFAULT_ICON_PATH"

usage() {
  cat <<'EOF'
Usage: bash client/scripts/build-mac-dmg.sh [options]

Options:
  --app PATH           Packaged .app bundle to place in the DMG
  --output PATH        Output DMG path
  --volume-name NAME   Mounted DMG volume name
  --background PATH    Background image to use inside the DMG
  --applications PATH  Applications link target (default: /Applications)
  --icon PATH          Mounted volume icon (.icns)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP_PATH="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --volume-name)
      VOLUME_NAME="$2"
      shift 2
      ;;
    --background)
      BACKGROUND_PATH="$2"
      shift 2
      ;;
    --applications)
      APPLICATIONS_PATH="$2"
      shift 2
      ;;
    --icon)
      ICON_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH" >&2
  exit 1
fi

if [[ ! -f "$BACKGROUND_PATH" ]]; then
  echo "DMG background not found: $BACKGROUND_PATH" >&2
  exit 1
fi

if [[ ! -f "$ICON_PATH" ]]; then
  echo "DMG icon not found: $ICON_PATH" >&2
  exit 1
fi

APP_BUNDLE_NAME="$(basename "$APP_PATH")"
APP_DISPLAY_NAME="${APP_BUNDLE_NAME%.app}"
VOLUME_NAME="${VOLUME_NAME:-$APP_DISPLAY_NAME}"

if [[ -z "$OUTPUT_PATH" ]]; then
  OUTPUT_PATH="$CLIENT_DIR/out/${APP_DISPLAY_NAME}.dmg"
fi

OUTPUT_DIR_RAW="$(dirname "$OUTPUT_PATH")"
mkdir -p "$OUTPUT_DIR_RAW"
OUTPUT_DIR="$(cd "$OUTPUT_DIR_RAW" && pwd)"
OUTPUT_PATH="$OUTPUT_DIR/$(basename "$OUTPUT_PATH")"

BACKGROUND_RETINA_PATH="${BACKGROUND_PATH%.*}@2x.${BACKGROUND_PATH##*.}"
BACKGROUND_WIDTH="$(sips -g pixelWidth "$BACKGROUND_PATH" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
BACKGROUND_HEIGHT="$(sips -g pixelHeight "$BACKGROUND_PATH" 2>/dev/null | awk '/pixelHeight/ {print $2}')"

if [[ -z "$BACKGROUND_WIDTH" || -z "$BACKGROUND_HEIGHT" ]]; then
  echo "Unable to read DMG background dimensions from $BACKGROUND_PATH" >&2
  exit 1
fi

WINDOW_WIDTH=$((BACKGROUND_WIDTH + 40))
WINDOW_HEIGHT=$((BACKGROUND_HEIGHT + 70))
WINDOW_POS_X=140
WINDOW_POS_Y=120
APP_ICON_X=$((BACKGROUND_WIDTH / 2 - 160))
APPLICATIONS_ICON_X=$((BACKGROUND_WIDTH / 2 + 160))
ICON_Y=$((BACKGROUND_HEIGHT / 2 + 8))
ICON_SIZE=120

APPDMG_BIN="$CLIENT_DIR/node_modules/appdmg/bin/appdmg.js"
ELECTRON_NODE="$CLIENT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
DMGBUILD_BIN="${DMGBUILD_BIN:-}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guild-appdmg.XXXXXX")"
SPEC_PATH="$TMP_DIR/appdmg.json"
STAGED_APP_PATH="$TMP_DIR/$APP_BUNDLE_NAME"
STAGED_BACKGROUND_PATH="$TMP_DIR/dmg-background.png"
STAGED_ICON_PATH="$TMP_DIR/icon.icns"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

cp -R "$APP_PATH" "$STAGED_APP_PATH"
cp "$BACKGROUND_PATH" "$STAGED_BACKGROUND_PATH"
cp "$ICON_PATH" "$STAGED_ICON_PATH"

if [[ -f "$BACKGROUND_RETINA_PATH" ]]; then
  cp "$BACKGROUND_RETINA_PATH" "$TMP_DIR/dmg-background@2x.png"
fi

cat > "$SPEC_PATH" <<EOF
{
  "title": "$VOLUME_NAME",
  "icon": "$STAGED_ICON_PATH",
  "background": "$STAGED_BACKGROUND_PATH",
  "icon-size": $ICON_SIZE,
  "window": {
    "position": {
      "x": $WINDOW_POS_X,
      "y": $WINDOW_POS_Y
    },
    "size": {
      "width": $WINDOW_WIDTH,
      "height": $WINDOW_HEIGHT
    }
  },
  "format": "ULFO",
  "filesystem": "HFS+",
  "contents": [
    { "x": $APP_ICON_X, "y": $ICON_Y, "type": "file", "path": "$STAGED_APP_PATH" },
    { "x": $APPLICATIONS_ICON_X, "y": $ICON_Y, "type": "link", "path": "$APPLICATIONS_PATH" }
  ]
}
EOF

if [[ -n "$DMGBUILD_BIN" ]]; then
  "$DMGBUILD_BIN" -s "$SPEC_PATH" "$VOLUME_NAME" "$OUTPUT_PATH"
elif command -v dmgbuild >/dev/null 2>&1; then
  "$(command -v dmgbuild)" -s "$SPEC_PATH" "$VOLUME_NAME" "$OUTPUT_PATH"
else
  if [[ ! -f "$APPDMG_BIN" ]]; then
    echo "appdmg CLI not found: $APPDMG_BIN" >&2
    exit 1
  fi

  RUNNER=()
  if command -v node >/dev/null 2>&1; then
    RUNNER=("$(command -v node)")
  elif [[ -x "$ELECTRON_NODE" ]]; then
    export ELECTRON_RUN_AS_NODE=1
    export ELECTRON_NO_ASAR=1
    RUNNER=("$ELECTRON_NODE")
  else
    echo "No supported DMG builder runtime found" >&2
    exit 1
  fi

  "${RUNNER[@]}" "$APPDMG_BIN" "$SPEC_PATH" "$OUTPUT_PATH"
fi

echo "Created $OUTPUT_PATH"
