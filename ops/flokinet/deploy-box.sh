#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${GUILD_FLOKINET_HOST:-}"
SSH_USER="${GUILD_FLOKINET_USER:-$USER}"
SSH_KEY="${GUILD_FLOKINET_SSH_KEY:-}"
REMOTE_STAGE_DIR="${GUILD_FLOKINET_STAGE_DIR:-}"
APPLY=0
START_SERVICE=0

usage() {
  cat <<'EOF'
Usage: ops/flokinet/deploy-box.sh --host HOST [options]

Dry-run by default. This prepares a FlokiNET box for `/guild` by:
- rsyncing the repo to a per-user staging directory
- syncing the staged repo into /opt/guild on the server
- installing server dependencies as the `guild` user
- installing the systemd unit and env template

It does not start the service unless you pass --start-service.

Options:
  --host HOST         Remote server IP or hostname
  --user USER         SSH user (default: current local username)
  --ssh-key PATH      SSH identity file
  --stage-dir PATH    Remote staging directory (default: /home/USER/guild-deploy)
  --start-service     Enable and start guild-server after sync/install
  --apply             Execute the deploy
  -h, --help          Show this help

Environment:
  GUILD_FLOKINET_HOST
  GUILD_FLOKINET_USER
  GUILD_FLOKINET_SSH_KEY
  GUILD_FLOKINET_STAGE_DIR
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

if [[ -z "$REMOTE_STAGE_DIR" ]]; then
  REMOTE_STAGE_DIR="/home/$SSH_USER/guild-deploy"
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
- sync $REMOTE_STAGE_DIR/ into /opt/guild/
- preserve runtime data directories
- install server dependencies
- copy the env template if /etc/guild/guild-server.env does not exist
- install guild-server.service
EOF
  exit 0
fi

echo "[apply] Syncing repo to $SSH_USER@$HOST:$REMOTE_STAGE_DIR"
ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "mkdir -p '$REMOTE_STAGE_DIR'"
rsync "${RSYNC_ARGS[@]}" -e "ssh ${SSH_OPTS[*]}" "$ROOT_DIR/" "$SSH_USER@$HOST:$REMOTE_STAGE_DIR/"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail

sudo mkdir -p /opt/guild /opt/guild/server/data /opt/guild/uploads /opt/guild/updates /etc/guild

sudo rsync -a --delete \\
  --exclude server/data/ \\
  --exclude uploads/ \\
  --exclude updates/ \\
  '$REMOTE_STAGE_DIR/' /opt/guild/

sudo chown -R guild:guild /opt/guild /etc/guild

if [[ ! -f /etc/guild/guild-server.env ]]; then
  sudo cp /opt/guild/ops/flokinet/guild-server.env.example /etc/guild/guild-server.env
fi

sudo cp /opt/guild/ops/flokinet/guild-server.service /etc/systemd/system/guild-server.service
sudo systemctl daemon-reload
sudo -u guild npm --prefix /opt/guild/server install --omit=dev
sudo -u guild node /opt/guild/server/scripts/ensureBetterSqlite3.js

if [[ "$START_SERVICE" -eq 1 ]]; then
  sudo systemctl enable guild-server
  sudo systemctl restart guild-server
  sudo systemctl status guild-server --no-pager
else
  sudo systemctl status guild-server --no-pager || true
fi
EOF
)

ssh -tt "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$REMOTE_SCRIPT"

echo "[apply] Box staged on $HOST"
