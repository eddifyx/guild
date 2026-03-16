# Dev Dashboard

This dashboard is a separate process that reads protected live metrics from the main `/guild` server.

## What It Covers

- HTTP traffic and error rate
- Socket connection volume and auth failures
- Online users and active sessions
- Voice channel occupancy and mediasoup load
- VPS load average, memory usage, disk usage, and network interfaces
- Recent runtime warnings like slow requests and handler failures

## Server Endpoint

The main server now exposes:

- `GET /api/dev/health`
- `GET /api/dev/metrics`

Access rules:

- If `DEV_DASHBOARD_KEY` is set, send it in `x-dev-dashboard-key` or `Authorization: Bearer ...`
- If `DEV_DASHBOARD_KEY` is not set, the endpoints are loopback-only

## Run It

Start the main server as usual:

```bash
npm run dev:server
```

Then run the dashboard in a separate terminal:

```bash
DEV_DASHBOARD_KEY=change-me node ops-dashboard/server.js
```

Open:

```bash
http://127.0.0.1:3010
```

Optional env vars:

- `DASHBOARD_PORT`: dashboard port, default `3010`
- `DEV_DASHBOARD_SOURCE`: base URL for the app server, default `http://127.0.0.1:3001`
- `DEV_DASHBOARD_KEY`: shared secret used by both the app server and dashboard

Example with an explicit server target:

```bash
DEV_DASHBOARD_SOURCE=http://127.0.0.1:3001 \
DEV_DASHBOARD_KEY=change-me \
node ops-dashboard/server.js
```

## Deployment Notes

- Keep the dashboard behind your own VPN, Tailscale, SSH tunnel, or reverse-proxy auth if you expose it beyond localhost.
- The dashboard is meant for operator visibility, not normal users.
- For a later production step, this can feed Prometheus/Grafana or Sentry instead of replacing them.
