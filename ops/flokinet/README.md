# FlokiNET Launch Runbook

This runbook is the single-platform, privacy-first deployment for `/guild`.

Assumption:

- provider: `FlokiNET`
- first location: `Iceland`

If later you decide you want lower latency for mainland Europe, Finland or the
Netherlands may be better fit locations, but Iceland is the cleanest match for
the anonymous-by-design direction discussed in this thread.

## Recommended First Box

Start with a VPS tier that is as close as possible to:

- `4 GB RAM`
- `4 vCPU`
- `80+ GB SSD/NVMe`
- `4+ TB transfer`
- `Ubuntu 24.04 LTS`
- `SSH key only`

This is the smallest size I would recommend for a single public `/guild` box
that may carry chat, uploads, updates, and moderate voice usage.

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
- `10000-10100/udp` for production mediasoup RTP
- `10000-10100/tcp` for production mediasoup fallback transport
- `10101-10200/udp` for staging mediasoup RTP
- `10101-10200/tcp` for staging mediasoup fallback transport

Do not expose `3001` publicly once Caddy is in front.
Do not expose `3002` publicly either if staging lives on the same box.

## Server Layout

Use this layout on the host:

```text
/opt/guild
  client/
  server/
  uploads/
  updates/
/opt/guild-staging
  client/
  server/
  uploads/
  updates/
```

Production writes here by default:

- database: `/opt/guild/server/data/messenger.db`
- uploads: `/opt/guild/uploads`
- updates: `/opt/guild/updates`

Staging writes here by default:

- database: `/opt/guild-staging/server/data/messenger.db`
- uploads: `/opt/guild-staging/uploads`
- updates: `/opt/guild-staging/updates`

## Initial Provisioning

Run these on the server after first SSH login:

```bash
apt update
apt install -y build-essential python3 make g++ curl rsync ufw caddy
```

Install Node 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
node -v
npm -v
```

Create the app user and directories:

```bash
adduser --system --group --home /opt/guild guild
mkdir -p /opt/guild /opt/guild-staging /etc/guild
chown -R guild:guild /opt/guild /opt/guild-staging /etc/guild
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
  ./ root@YOUR_SERVER_IP:/opt/guild/
```

Then on the server:

```bash
cd /opt/guild/server
npm install
```

`npm start` will run the server-local `better-sqlite3` rebuild helper
automatically.

## Environment

Production env:

```bash
cp /opt/guild/ops/flokinet/guild-server.env.example /etc/guild/guild-server.env
nano /etc/guild/guild-server.env
```

Staging env:

```bash
cp /opt/guild-staging/ops/flokinet/guild-staging.env.example /etc/guild/guild-staging.env
nano /etc/guild/guild-staging.env
```

Minimum fields to set for both:

- `ANNOUNCED_IP`
- `ALLOWED_ORIGINS`
- `DEV_DASHBOARD_KEY`

Important staging-only fields:

- `PORT=3002`
- `MEDIASOUP_RTC_MIN_PORT=10101`
- `MEDIASOUP_RTC_MAX_PORT=10200`
- staging-only hostname in `ALLOWED_ORIGINS`

## systemd

Production unit:

```bash
cp /opt/guild/ops/flokinet/guild-server.service /etc/systemd/system/guild-server.service
systemctl daemon-reload
systemctl enable guild-server
systemctl start guild-server
systemctl status guild-server
```

Staging unit:

```bash
cp /opt/guild-staging/ops/flokinet/guild-staging.service /etc/systemd/system/guild-staging.service
systemctl daemon-reload
systemctl enable guild-staging
systemctl start guild-staging
systemctl status guild-staging
```

Useful logs:

```bash
journalctl -u guild-server -f
journalctl -u guild-staging -f
```

## Reverse Proxy

Copy the Caddy example and replace the hostname:

```bash
cp /opt/guild/ops/flokinet/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
systemctl reload caddy
```

Point both production and staging DNS names at the server before reloading
Caddy so ACME can issue the certs.

## Firewall

Example `ufw` setup:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 10000:10200/udp
ufw allow 10000:10200/tcp
ufw enable
```

## Smoke Test

On the host:

```bash
curl -I http://127.0.0.1:3001/api/version
curl -I http://127.0.0.1:3002/api/version
curl -I https://YOUR_PROD_DOMAIN/api/version
curl -I https://YOUR_STAGING_DOMAIN/api/version
```

Each mediasoup worker should log the public `ANNOUNCED_IP` on startup.

## Staging-First Deploy Flow

If production is already live, use this order:

1. `ops/flokinet/bootstrap-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER`
2. `ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --target staging`
3. Fill in `/etc/guild/guild-staging.env`
4. Start `guild-staging`
5. Point a staging hostname such as `staging.guild.example.com` to the box
6. Confirm staging voice/chat/update flows before touching production

When you are happy with staging:

1. `ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --target production`
2. Restart only `guild-server`

## Suggested Next Sequence

1. Create the FlokiNET VPS in Iceland
2. Add your SSH public key
3. Point a test DNS name at the server
4. Send the server IP back into this thread
5. Run the host hardening and app copy steps
6. Confirm `/api/version` and voice transport startup
7. Add a simple local snapshot + off-box backup routine later

## Faster Scripted Path

This folder now includes two helper scripts:

- `bootstrap-box.sh`
  - installs system packages, Node 24, and creates both app roots
  - dry-run by default
- `deploy-box.sh`
  - rsyncs the repo to a remote staging directory
  - syncs that staged copy into either `/opt/guild` or `/opt/guild-staging`
  - installs server dependencies and the matching systemd unit
  - dry-run by default

Example:

```bash
# From the local repo root
ops/flokinet/bootstrap-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER
ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --target staging

# Apply once the dry-run output looks right
ops/flokinet/bootstrap-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --apply
ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --target staging --apply
```

If the remote SSH user requires a sudo password, both scripts are meant to be
run from an interactive terminal so you can enter it when prompted.
