# 1984 Existing VPS Runbook

This runbook is the fastest path to getting `/guild` onto the 1984 VPS you
already have.

Assumptions:

- provider: `1984`
- this is an existing VPS you can already SSH into
- OS family: `Ubuntu` or `Debian`

If the box is still the smaller 1984 VPS tier, that is fine for getting live
and testing the full stack. Just expect to watch CPU, RAM, and bandwidth once
voice usage grows.

## Current Server Topology

The existing 1984 VPS is already running a split deployment:

- production app: `/root/byzantine-server`
- staging app: `/root/byzantine-staging`
- PM2 process name: `byzantine` on port `3001`
- PM2 process name: `byzantine-staging` on port `3002`

This means the safest path is:

1. stage server code into `/root/byzantine-staging`
2. test there first
3. publish version metadata and update ZIPs only when you are ready

There is currently no `caddy` reverse proxy installed on this VPS.

## What Runs On The Box

- `/guild` Node server
- SQLite database
- authenticated uploads
- update ZIP hosting
- mediasoup voice relay
- TLS reverse proxy

## Ports

Open on the host:

- `22/tcp` for SSH
- `80/tcp` for ACME / HTTP redirect
- `443/tcp` for HTTPS
- `10000-10100/udp` for mediasoup RTP
- `10000-10100/tcp` for mediasoup fallback transport

Do not expose `3001` publicly once Caddy is in front.

## Server Layout

Use this layout on the host:

```text
/opt/guild
  client/
  server/
  uploads/
  updates/
```

The server writes here by default:

- database: `/opt/guild/server/data/messenger.db`
- uploads: `/opt/guild/uploads`
- updates: `/opt/guild/updates`

## Initial Provisioning

Run these on the server after first SSH login:

```bash
sudo apt update
sudo apt install -y build-essential python3 make g++ curl rsync ufw caddy
```

Install Node 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs
node -v
npm -v
```

Create the app user and directories:

```bash
sudo adduser --system --group --home /opt/guild guild
sudo mkdir -p /opt/guild /etc/guild
sudo chown -R guild:guild /opt/guild /etc/guild
```

## Copying The App To The Server

This repo is currently a local workspace, so use `rsync` from your machine
instead of `git clone`.

From the local project root:

```bash
rsync -av \
  --exclude node_modules \
  --exclude client/node_modules \
  --exclude server/node_modules \
  --exclude client/dist \
  --exclude client/out \
  --exclude uploads \
  --exclude updates \
  --exclude server/data \
  ./ YOUR_SSH_USER@YOUR_SERVER_IP:/opt/guild/
```

Then on the server:

```bash
cd /opt/guild/server
npm install
```

`npm start` will run the server-local `better-sqlite3` rebuild helper
automatically.

## Environment

Copy the example env file:

```bash
sudo cp /opt/guild/ops/1984/guild-server.env.example /etc/guild/guild-server.env
sudo nano /etc/guild/guild-server.env
```

Minimum fields to set:

- `ANNOUNCED_IP`
- `ALLOWED_ORIGINS`
- `DEV_DASHBOARD_KEY`

Optional but important if you want a true zero-guild state:

- `SEED_DEFAULT_GUILD=0`
  - prevents the app from auto-creating `/guild` on startup
  - if left unset or set to `1`, `/guild` will be recreated after a reset on the next restart

## systemd

Copy the unit file into place:

```bash
sudo cp /opt/guild/ops/1984/guild-server.service /etc/systemd/system/guild-server.service
sudo systemctl daemon-reload
sudo systemctl enable guild-server
sudo systemctl start guild-server
sudo systemctl status guild-server
```

Useful logs:

```bash
sudo journalctl -u guild-server -f
```

## Reverse Proxy

Copy the Caddy example and replace the hostname:

```bash
sudo cp /opt/guild/ops/1984/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Point DNS to the server before reloading Caddy so ACME can issue the cert.

## Firewall

Example `ufw` setup:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 10000:10100/udp
sudo ufw allow 10000:10100/tcp
sudo ufw enable
```

## Smoke Test

On the host:

```bash
curl -I http://127.0.0.1:3001/api/version
curl -I https://YOUR_DOMAIN/api/version
```

The mediasoup worker should log the public `ANNOUNCED_IP` on startup.

## Lean-Box Note

If this 1984 VPS is still the smaller tier:

- start with audio-first testing
- keep screen share/video usage limited
- watch RAM during `npm install` and first boot
- upgrade only after you confirm actual usage patterns

## Suggested Next Sequence

1. SSH into the existing 1984 VPS
2. Install the base packages and Node 24
3. Copy the repo to `/opt/guild`
4. Fill in `/etc/guild/guild-server.env`
5. Start `guild-server` and verify `/api/version`
6. Add Caddy and DNS
7. Open mediasoup ports and test voice

## Existing-Server Release Flow

For this specific VPS, use the scripts in this folder instead of the generic
`/opt/guild` runbook:

- `deploy-staging-server.sh`
  - syncs the local `server/` directory into `/root/byzantine-staging`
  - preserves `data/`, `uploads/`, and `updates/`
  - runs the native module sanity script
  - restarts only the staging PM2 process
- `publish-update-artifacts.sh`
  - copies release ZIPs into the target `updates/` directory
  - updates `client-version.json`
  - should be used only when you are ready to expose the new app update

Both scripts default to a dry-run. Use `--apply` to make changes.

## Resetting Guilds

The server now includes `server/scripts/resetGuilds.js` and an SSH wrapper:

- `ops/1984/reset-guilds.sh`

Examples:

```bash
# Inspect what would be deleted on staging.
ops/1984/reset-guilds.sh --target staging

# Delete only user-created guilds and preserve /guild on production.
ops/1984/reset-guilds.sh --target production --keep-default --apply

# Delete every guild, including /guild, on production.
ops/1984/reset-guilds.sh --target production --apply
```

For a stable zero-guild state, make sure the running app environment also has:

```bash
SEED_DEFAULT_GUILD=0
```

Otherwise the reset will work immediately, but `/guild` will come back the next
time the server process restarts.
