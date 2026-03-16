#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${GUILD_FLOKINET_HOST:-}"
SSH_USER="${GUILD_FLOKINET_USER:-$USER}"
SSH_KEY="${GUILD_FLOKINET_SSH_KEY:-}"
REMOTE_STAGE_DIR="${GUILD_FLOKINET_STAGE_DIR:-}"
TARGET="${GUILD_FLOKINET_TARGET:-staging}"
APPLY=0
START_SERVICE=0

usage() {
  cat <<'EOF'
Usage: ops/flokinet/deploy-box.sh --host HOST [options]

Dry-run by default. This prepares a FlokiNET box for `/guild` by:
- rsyncing the repo to a per-user staging directory
- syncing the staged repo into the selected app root on the server
- installing server dependencies as the `guild` user
- installing the target-specific systemd unit and env template

It does not start the service unless you pass --start-service.
Defaults to the safer `staging` target.

Options:
  --host HOST         Remote server IP or hostname
  --user USER         SSH user (default: current local username)
  --ssh-key PATH      SSH identity file
  --stage-dir PATH    Remote sync directory (default: /home/USER/guild-deploy-TARGET)
  --target NAME       staging or production (default: staging)
  --start-service     Enable and start the target service after sync/install
  --apply             Execute the deploy
  -h, --help          Show this help

Environment:
  GUILD_FLOKINET_HOST
  GUILD_FLOKINET_USER
  GUILD_FLOKINET_SSH_KEY
  GUILD_FLOKINET_STAGE_DIR
  GUILD_FLOKINET_TARGET
EOF
}

while (($#)); do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift
      ;;
    --user)
      SSH_USER="${2:-}"
      shift
      ;;
    --ssh-key)
      SSH_KEY="${2:-}"
      shift
      ;;
    --stage-dir)
      REMOTE_STAGE_DIR="${2:-}"
      shift
      ;;
    --target)
      TARGET="${2:-}"
      shift
      ;;
    --start-service)
      START_SERVICE=1
      ;;
    --apply)
      APPLY=1
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

if [[ -z "$HOST" ]]; then
  echo "--host is required" >&2
  usage >&2
  exit 1
fi

case "$TARGET" in
  production)
    REMOTE_APP_DIR="/opt/guild"
    SERVICE_NAME="guild-server"
    REMOTE_ENV_FILE="/etc/guild/guild-server.env"
    REMOTE_ENV_TEMPLATE="/opt/guild/ops/flokinet/guild-server.env.example"
    REMOTE_SERVICE_FILE="/etc/systemd/system/guild-server.service"
    REMOTE_SERVICE_TEMPLATE="/opt/guild/ops/flokinet/guild-server.service"
    ;;
  staging)
    REMOTE_APP_DIR="/opt/guild-staging"
    SERVICE_NAME="guild-staging"
    REMOTE_ENV_FILE="/etc/guild/guild-staging.env"
    REMOTE_ENV_TEMPLATE="/opt/guild-staging/ops/flokinet/guild-staging.env.example"
    REMOTE_SERVICE_FILE="/etc/systemd/system/guild-staging.service"
    REMOTE_SERVICE_TEMPLATE="/opt/guild-staging/ops/flokinet/guild-staging.service"
    ;;
  *)
    echo "Invalid target: $TARGET" >&2
    usage >&2
    exit 1
    ;;
esac

if [[ -z "$REMOTE_STAGE_DIR" ]]; then
  REMOTE_STAGE_DIR="/home/$SSH_USER/guild-deploy-$TARGET"
fi

SSH_OPTS=(-o StrictHostKeyChecking=no)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

RSYNC_ARGS=(
  -az
  --delete
  --exclude .git/
  --exclude node_modules/
  --exclude client/node_modules/
  --exclude server/node_modules/
  --exclude client/dist/
  --exclude client/out/
  --exclude uploads/
  --exclude updates/
  --exclude server/data/
  --exclude .DS_Store
)

if [[ "$APPLY" -eq 0 ]]; then
  cat <<EOF
[dry-run] Would sync:
  $ROOT_DIR/ -> $SSH_USER@$HOST:$REMOTE_STAGE_DIR/

Remote install step would:
- sync $REMOTE_STAGE_DIR/ into $REMOTE_APP_DIR/
- preserve runtime data directories
- install server dependencies
- copy the env template if $REMOTE_ENV_FILE does not exist
- install $SERVICE_NAME.service
EOF
  exit 0
fi

echo "[apply] Syncing repo to $SSH_USER@$HOST:$REMOTE_STAGE_DIR"
ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "mkdir -p '$REMOTE_STAGE_DIR'"
rsync "${RSYNC_ARGS[@]}" -e "ssh ${SSH_OPTS[*]}" "$ROOT_DIR/" "$SSH_USER@$HOST:$REMOTE_STAGE_DIR/"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail

sudo mkdir -p '$REMOTE_APP_DIR' '$REMOTE_APP_DIR/server/data' '$REMOTE_APP_DIR/uploads' '$REMOTE_APP_DIR/updates' /etc/guild

sudo rsync -a --delete \\
  --exclude server/data/ \\
  --exclude uploads/ \\
  --exclude updates/ \\
  '$REMOTE_STAGE_DIR/' '$REMOTE_APP_DIR/'

sudo chown -R guild:guild '$REMOTE_APP_DIR' /etc/guild

if [[ ! -f '$REMOTE_ENV_FILE' ]]; then
  sudo cp '$REMOTE_ENV_TEMPLATE' '$REMOTE_ENV_FILE'
fi

sudo cp '$REMOTE_SERVICE_TEMPLATE' '$REMOTE_SERVICE_FILE'
sudo systemctl daemon-reload
sudo -u guild npm --prefix '$REMOTE_APP_DIR/server' install --omit=dev
sudo -u guild node '$REMOTE_APP_DIR/server/scripts/ensureBetterSqlite3.js'

if [[ "$START_SERVICE" -eq 1 ]]; then
  sudo systemctl enable '$SERVICE_NAME'
  sudo systemctl restart '$SERVICE_NAME'
  sudo systemctl status '$SERVICE_NAME' --no-pager
else
  sudo systemctl status '$SERVICE_NAME' --no-pager || true
fi
EOF
)

ssh -tt "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$REMOTE_SCRIPT"

echo "[apply] $TARGET deployed on $HOST"
