#!/usr/bin/env bash
set -euo pipefail

HOST="${GUILD_1984_HOST:-89.127.232.111}"
USER="${GUILD_1984_USER:-root}"
SSH_KEY="${GUILD_1984_SSH_KEY:-}"
TARGET="${GUILD_1984_TARGET:-production}"
VERSION=""
APPLY=0
ARTIFACTS=()

usage() {
  cat <<'EOF'
Usage: ops/1984/publish-update-artifacts.sh [--apply] --version X.Y.Z [--target staging|production] <zip> [<zip>...]

Dry-run by default. This copies update ZIPs to the target updates directory and
updates client-version.json on the existing 1984 VPS.
EOF
}

while (($#)); do
  case "$1" in
    --apply)
      APPLY=1
      ;;
    --version)
      VERSION="${2:-}"
      shift
      ;;
    --target)
      TARGET="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ARTIFACTS+=("$1")
      ;;
  esac
  shift
done

if [[ -z "$VERSION" ]]; then
  echo "--version is required" >&2
  exit 1
fi

if [[ "${#ARTIFACTS[@]}" -eq 0 ]]; then
  echo "At least one artifact path is required" >&2
  exit 1
fi

case "$TARGET" in
  staging)
    REMOTE_DIR="/root/byzantine-staging"
    ;;
  production)
    REMOTE_DIR="/root/byzantine-server"
    ;;
  *)
    echo "Invalid target: $TARGET" >&2
    exit 1
    ;;
esac

SSH_OPTS=(-o StrictHostKeyChecking=no)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

RSYNC_ARGS=(-az)
if [[ "$APPLY" -eq 0 ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
  echo "[dry-run] Publishing artifacts to $USER@$HOST:$REMOTE_DIR/updates/"
else
  echo "[apply] Publishing artifacts to $USER@$HOST:$REMOTE_DIR/updates/"
fi

rsync "${RSYNC_ARGS[@]}" -e "ssh ${SSH_OPTS[*]}" "${ARTIFACTS[@]}" "$USER@$HOST:$REMOTE_DIR/updates/"

VERSION_JSON="{ \"version\": \"$VERSION\" }"

if [[ "$APPLY" -eq 0 ]]; then
  echo "[dry-run] Would write client-version.json => $VERSION_JSON"
  exit 0
fi

ssh "${SSH_OPTS[@]}" "$USER@$HOST" "
  set -euo pipefail
  printf '%s\n' '$VERSION_JSON' > '$REMOTE_DIR/client-version.json'
"

echo "[apply] Updated $REMOTE_DIR/client-version.json to $VERSION"
