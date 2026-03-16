#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$ROOT_DIR/server/"
HOST="${GUILD_1984_HOST:-89.127.232.111}"
USER="${GUILD_1984_USER:-root}"
SSH_KEY="${GUILD_1984_SSH_KEY:-}"
TARGET="${GUILD_1984_TARGET:-staging}"
APPLY=0

usage() {
  cat <<'EOF'
Usage: ops/1984/deploy-staging-server.sh [--apply] [--target staging|production]

Dry-run by default. This syncs the local server/ directory to the existing
1984 VPS deployment path while preserving runtime data.
EOF
}

while (($#)); do
  case "$1" in
    --apply)
      APPLY=1
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
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

case "$TARGET" in
  staging)
    REMOTE_DIR="/root/byzantine-staging"
    PM2_NAME="byzantine-staging"
    ;;
  production)
    REMOTE_DIR="/root/byzantine-server"
    PM2_NAME="byzantine"
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

RSYNC_ARGS=(
  -az
  --delete
  --exclude data/
  --exclude uploads/
  --exclude updates/
  --exclude node_modules/
  --exclude .DS_Store
)

if [[ "$APPLY" -eq 0 ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
  echo "[dry-run] Syncing $SOURCE_DIR to $USER@$HOST:$REMOTE_DIR"
else
  echo "[apply] Syncing $SOURCE_DIR to $USER@$HOST:$REMOTE_DIR"
fi

rsync "${RSYNC_ARGS[@]}" -e "ssh ${SSH_OPTS[*]}" "$SOURCE_DIR" "$USER@$HOST:$REMOTE_DIR/"

if [[ "$APPLY" -eq 0 ]]; then
  echo "[dry-run] No remote install or restart performed."
  exit 0
fi

ssh "${SSH_OPTS[@]}" "$USER@$HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  npm install --omit=dev
  node scripts/ensureBetterSqlite3.js
  pm2 restart '$PM2_NAME'
  pm2 save
"

echo "[apply] $PM2_NAME refreshed on $HOST"
