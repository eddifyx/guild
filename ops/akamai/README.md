# Akamai Launch Runbook

This runbook is the lean first-tier deployment for `/guild`:

- Primary: `Akamai Cloud` in `Los Angeles (us-lax)`
- Backup/admin: existing `1984 Iceland` box

The goal is to keep launch cost and setup time low while making the LA voice path real enough to test.

## Recommended First Box

Start with:

- Provider: `Akamai Cloud`
- Region: `Los Angeles (us-lax)`
- Plan: `Linode 4 GB shared CPU`
- OS: `Ubuntu 24.04 LTS`
- Auth: `SSH key only`

Upgrade to `Linode 8 GB` only if voice testing starts to feel cramped.

## What Runs Where

### Akamai LA

- `/guild` Node server
- SQLite database
- authenticated uploads
- update ZIP hosting
- mediasoup voice relay
- TLS reverse proxy

### 1984 Iceland

- offsite backup target
- private admin path over WireGuard or Tailscale later
- uptime checks / recovery use

Do not try to serve production traffic from the Iceland box in tier one.

## Ports

Open on the LA host:

- `22/tcp` for SSH
- `80/tcp` for ACME / HTTP redirect
- `443/tcp` for HTTPS
- `10000-10100/udp` for mediasoup RTP
- `10000-10100/tcp` for mediasoup fallback transport

Do not expose `3001` publicly once Caddy is in front.

## Server Layout

Use this layout on the LA host:

```text
/opt/guild
  client/
  server/
  uploads/
  updates/
```

The server code writes here by default:

- database: `/opt/guild/server/data/messenger.db`
- uploads: `/opt/guild/uploads`
- updates: `/opt/guild/updates`

## Initial Provisioning

Run these on the LA host after first SSH login:

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

This repo is currently a local workspace, so use `rsync` from your machine instead of `git clone`.

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
  ./ root@YOUR_LA_IP:/opt/guild/
```

Then on the server:

```bash
cd /opt/guild/server
npm install
```

`npm start` will run the server-local `better-sqlite3` rebuild helper automatically.

## Environment

Copy the example env file:

```bash
cp /opt/guild/ops/akamai/guild-server.env.example /etc/guild/guild-server.env
nano /etc/guild/guild-server.env
```

Minimum fields to set:

- `ANNOUNCED_IP`
- `ALLOWED_ORIGINS`
- `DEV_DASHBOARD_KEY`

## systemd

Copy the unit file into place:

```bash
cp /opt/guild/ops/akamai/guild-server.service /etc/systemd/system/guild-server.service
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
cp /opt/guild/ops/akamai/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
systemctl reload caddy
```

Point DNS to the LA host before reloading Caddy so ACME can issue the cert.

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

On the LA host:

```bash
curl -I http://127.0.0.1:3001/api/version
curl -I https://YOUR_DOMAIN/api/version
```

The mediasoup worker should log the public `ANNOUNCED_IP` on startup.

## 1984 Backup Role

Tier one keeps 1984 intentionally light:

- receive encrypted DB snapshots
- receive `uploads/` and `updates/` snapshots
- hold restore instructions and a recent env backup

Do not treat the 1984 box as hot failover yet.

## Suggested Next Sequence

1. Create the Akamai `us-lax` box
2. Add your SSH public key
3. Point a test DNS name at the box
4. Send the box IP back into this thread
5. Run the host hardening and app copy steps
6. Confirm `/api/version` and voice transport startup
7. Add backup shipping to 1984
