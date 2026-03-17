#!/usr/bin/env bash
set -euo pipefail

HOST="${GUILD_FLOKINET_HOST:-}"
SSH_USER="${GUILD_FLOKINET_USER:-$USER}"
SSH_KEY="${GUILD_FLOKINET_SSH_KEY:-}"
APPLY=0
WITH_FIREWALL=0

usage() {
  cat <<'EOF'
Usage: ops/flokinet/bootstrap-box.sh --host HOST [options]

Dry-run by default. This bootstraps a FlokiNET Ubuntu box for `/guild` by:
- installing base packages
- installing Node 24
- creating the `guild` system user
- creating both production and staging app roots plus /etc/guild

Options:
  --host HOST        Remote server IP or hostname
  --user USER        SSH user (default: current local username)
  --ssh-key PATH     SSH identity file
  --with-firewall    Also configure and enable ufw
  --apply            Execute the remote bootstrap
  -h, --help         Show this help

Environment:
  GUILD_FLOKINET_HOST
  GUILD_FLOKINET_USER
  GUILD_FLOKINET_SSH_KEY
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
    --with-firewall)
      WITH_FIREWALL=1
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

SSH_OPTS=(-o StrictHostKeyChecking=no)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail

sudo apt update
sudo apt install -y build-essential python3 make g++ curl rsync ufw caddy

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -Eq '^v24\\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
  sudo apt install -y nodejs
fi

if ! id -u guild >/dev/null 2>&1; then
  sudo adduser --system --group --home /opt/guild guild
fi

sudo mkdir -p \
  /opt/guild/client /opt/guild/server /opt/guild/uploads /opt/guild/updates \
  /opt/guild-staging/client /opt/guild-staging/server /opt/guild-staging/uploads /opt/guild-staging/updates \
  /etc/guild
sudo chown -R guild:guild /opt/guild /opt/guild-staging /etc/guild
sudo chmod 755 \
  /opt/guild /opt/guild/client /opt/guild/server /opt/guild/uploads /opt/guild/updates \
  /opt/guild-staging /opt/guild-staging/client /opt/guild-staging/server /opt/guild-staging/uploads /opt/guild-staging/updates \
  /etc/guild

if [[ "$WITH_FIREWALL" -eq 1 ]]; then
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 10000:10200/udp
  sudo ufw allow 10000:10200/tcp
  sudo ufw --force enable
fi

node -v
npm -v
EOF
)

if [[ "$APPLY" -eq 0 ]]; then
  cat <<EOF
[dry-run] Would bootstrap $SSH_USER@$HOST

SSH command:
  ssh -tt ${SSH_OPTS[*]} $SSH_USER@$HOST

Remote actions:
$REMOTE_SCRIPT
EOF
  exit 0
fi

ssh -tt "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$REMOTE_SCRIPT"

echo "[apply] Bootstrap complete on $HOST"
