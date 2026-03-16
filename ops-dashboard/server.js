const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.DASHBOARD_PORT || 3010);
const sourceBase = process.env.DEV_DASHBOARD_SOURCE || 'http://127.0.0.1:3001';
const dashboardKey = process.env.DEV_DASHBOARD_KEY || '';
const publicDir = path.join(__dirname, 'public');

const metricsUrl = new URL('/api/dev/metrics', sourceBase);
const healthUrl = new URL('/api/dev/health', sourceBase);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function proxyJson(targetUrl, res) {
  try {
    const headers = { Accept: 'application/json' };
    if (dashboardKey) headers['x-dev-dashboard-key'] = dashboardKey;

    const response = await fetch(targetUrl, { headers });
    const text = await response.text();
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: 'Dashboard could not reach the app metrics endpoint',
      details: error.message,
      target: targetUrl.toString(),
    });
  }
}

function serveStatic(reqPath, res) {
  const requestedPath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(publicDir, requestedPath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      sendJson(res, 500, { error: 'Failed to read dashboard asset' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname === '/api/metrics') {
    proxyJson(metricsUrl, res);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
    proxyJson(healthUrl, res);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/config') {
    sendJson(res, 200, {
      pollingMs: 5000,
      metricsSource: metricsUrl.toString(),
      secured: !!dashboardKey,
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  serveStatic(requestUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Dev dashboard running on http://127.0.0.1:${PORT}`);
});
