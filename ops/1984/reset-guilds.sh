#!/usr/bin/env bash
set -euo pipefail

HOST="${GUILD_1984_HOST:-89.127.232.111}"
USER="${GUILD_1984_USER:-root}"
SSH_KEY="${GUILD_1984_SSH_KEY:-}"
TARGET="${GUILD_1984_TARGET:-production}"
APPLY=0
KEEP_DEFAULT=0

usage() {
  cat <<'EOF'
Usage: ops/1984/reset-guilds.sh [--apply] [--keep-default] [--target staging|production]

Dry-run by default. This runs the remote server/scripts/resetGuilds.js helper
against the existing 1984 VPS deployment.
EOF
}

while (($#)); do
  case "$1" in
    --apply)
      APPLY=1
      ;;
    --keep-default)
      KEEP_DEFAULT=1
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

REMOTE_ARGS=()
if [[ "$KEEP_DEFAULT" -eq 1 ]]; then
  REMOTE_ARGS+=(--keep-default)
fi
if [[ "$APPLY" -eq 1 ]]; then
  REMOTE_ARGS+=(--apply)
  echo "[apply] Resetting guilds on $USER@$HOST:$REMOTE_DIR"
else
  echo "[dry-run] Resetting guilds on $USER@$HOST:$REMOTE_DIR"
fi

ssh "${SSH_OPTS[@]}" "$USER@$HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  SEED_DEFAULT_GUILD=0 node scripts/resetGuilds.js ${REMOTE_ARGS[*]}
"

if [[ "$APPLY" -eq 1 ]]; then
  echo "[note] Future app restarts will recreate /guild unless the running server env also sets SEED_DEFAULT_GUILD=0."
fi
