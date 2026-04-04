#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$ROOT_DIR/server/"
SSH_TARGET="${GUILD_1984_SSH_TARGET:-}"
HOST="${GUILD_1984_HOST:-}"
USER="${GUILD_1984_USER:-}"
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
    REMOTE_DIR="/opt/guild-staging/server"
    SERVICE_NAME="guild-staging"
    ;;
  production)
    REMOTE_DIR="/opt/guild/server"
    SERVICE_NAME="guild-server"
    ;;
  *)
    echo "Invalid target: $TARGET" >&2
    exit 1
    ;;
esac

if [[ -n "$SSH_TARGET" ]]; then
  REMOTE="$SSH_TARGET"
elif [[ -n "$HOST" && -n "$USER" ]]; then
  REMOTE="$USER@$HOST"
elif [[ -n "$HOST" ]]; then
  REMOTE="$HOST"
else
  REMOTE="flokinet-guild"
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

if [[ "$APPLY" -eq 0 ]]; then
  echo "[dry-run] Would sync $SOURCE_DIR to $REMOTE:$REMOTE_DIR via a staged rsync + sudo install flow"
  echo "[dry-run] Would restart service: $SERVICE_NAME"
else
  echo "[apply] Syncing $SOURCE_DIR to $REMOTE:$REMOTE_DIR"
fi

if [[ "$APPLY" -eq 0 ]]; then
  echo "[dry-run] No remote install or restart performed."
  exit 0
fi

REMOTE_STAGE_DIR="$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "mktemp -d /tmp/guild-server-sync.XXXXXX"
)"

cleanup_remote_stage() {
  ssh "${SSH_OPTS[@]}" "$REMOTE" "rm -rf '$REMOTE_STAGE_DIR'" >/dev/null 2>&1 || true
}
trap cleanup_remote_stage EXIT

rsync -az \
  --delete \
  --exclude data/ \
  --exclude uploads/ \
  --exclude updates/ \
  --exclude node_modules/ \
  --exclude .DS_Store \
  -e "ssh ${SSH_OPTS[*]}" \
  "$SOURCE_DIR" "$REMOTE:$REMOTE_STAGE_DIR/"

ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s -- "$REMOTE_STAGE_DIR/server" "$REMOTE_DIR" "$SERVICE_NAME" <<'EOF'
set -euo pipefail

stage_dir="$1"
remote_dir="$2"
service_name="$3"

sudo rsync -az \
  --delete \
  --exclude data/ \
  --exclude uploads/ \
  --exclude updates/ \
  --exclude node_modules/ \
  --exclude .DS_Store \
  "$stage_dir/" "$remote_dir/"

cd "$remote_dir"
sudo npm install --omit=dev
sudo node scripts/ensureBetterSqlite3.js
sudo systemctl restart "$service_name"
sudo systemctl is-active "$service_name"
EOF

echo "[apply] $SERVICE_NAME refreshed on $REMOTE"
