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
mkdir -p /opt/guild /etc/guild
chown -R guild:guild /opt/guild /etc/guild
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

Copy the example env file:

```bash
cp /opt/guild/ops/flokinet/guild-server.env.example /etc/guild/guild-server.env
nano /etc/guild/guild-server.env
```

Minimum fields to set:

- `ANNOUNCED_IP`
- `ALLOWED_ORIGINS`
- `DEV_DASHBOARD_KEY`

## systemd

Copy the unit file into place:

```bash
cp /opt/guild/ops/flokinet/guild-server.service /etc/systemd/system/guild-server.service
systemctl daemon-reload
systemctl enable guild-server
systemctl start guild-server
systemctl status guild-server
```

Useful logs:

```bash
journalctl -u guild-server -f
```

## Reverse Proxy

Copy the Caddy example and replace the hostname:

```bash
cp /opt/guild/ops/flokinet/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
systemctl reload caddy
```

Point DNS to the server before reloading Caddy so ACME can issue the cert.

## Firewall

Example `ufw` setup:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 10000:10100/udp
ufw allow 10000:10100/tcp
ufw enable
```

## Smoke Test

On the host:

```bash
curl -I http://127.0.0.1:3001/api/version
curl -I https://YOUR_DOMAIN/api/version
```

The mediasoup worker should log the public `ANNOUNCED_IP` on startup.

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
  - installs system packages, Node 24, and creates `/opt/guild`
  - dry-run by default
- `deploy-box.sh`
  - rsyncs the repo to a remote staging directory
  - syncs that staging copy into `/opt/guild`
  - installs server dependencies and the `guild-server` unit
  - dry-run by default

Example:

```bash
# From the local repo root
ops/flokinet/bootstrap-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER
ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER

# Apply once the dry-run output looks right
ops/flokinet/bootstrap-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --apply
ops/flokinet/deploy-box.sh --host YOUR_SERVER_IP --user YOUR_SSH_USER --apply
```

If the remote SSH user requires a sudo password, both scripts are meant to be
run from an interactive terminal so you can enter it when prompted.
