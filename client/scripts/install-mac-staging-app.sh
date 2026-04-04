#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_OUT_PATH="${CLIENT_DIR}/out/guild-staging-darwin-arm64/guild-staging.app"
APP_DEST_PATH="/Applications/guild-staging.app"
DEFAULT_NODE_FALLBACK="/Users/eddifyx/Library/Caches/ms-playwright-go/1.50.1/node"

NODE_BIN="${NODE_BIN:-}"
if [[ -z "${NODE_BIN}" ]]; then
  NODE_BIN="$(command -v node || true)"
fi
if [[ -z "${NODE_BIN}" && -x "${DEFAULT_NODE_FALLBACK}" ]]; then
  NODE_BIN="${DEFAULT_NODE_FALLBACK}"
fi
if [[ -z "${NODE_BIN}" ]]; then
  echo "Unable to find a usable node binary. Set NODE_BIN or add node to PATH." >&2
  exit 1
fi

export PATH="$(dirname "${NODE_BIN}"):${PATH}"

export GUILD_APP_FLAVOR=staging
export GUILD_MAC_SIGN=1
export GUILD_MAC_SIGN_IDENTITY="${GUILD_MAC_SIGN_IDENTITY:-Developer ID Application}"

cd "${CLIENT_DIR}"
"${NODE_BIN}" node_modules/@electron-forge/cli/dist/electron-forge.js package --platform=darwin --arch=arm64

rm -rf "${APP_DEST_PATH}"
mkdir -p "/Applications"
rsync -a --delete "${APP_OUT_PATH}/" "${APP_DEST_PATH}/"

codesign --verify --deep --strict "${APP_DEST_PATH}"
codesign -dv --verbose=2 "${APP_DEST_PATH}" 2>&1 | sed -n '1,20p'

echo
echo "Installed signed staging app at ${APP_DEST_PATH}"
echo "If Screen Recording was previously granted to an ad-hoc build, reset once with:"
echo "  tccutil reset ScreenCapture is.1984.guild.staging"
echo "Then relaunch ${APP_DEST_PATH} and re-grant access in System Settings."
