const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const {
  clearAllVoiceSessions,
  getExpiredAssetDumps,
  deleteExpiredAssetDumps,
  deleteExpiredSessions,
  getExpiredUnclaimedUploadedFiles,
  deleteExpiredUnclaimedUploadedFiles,
  getSession,
  hashToken,
  getUploadedFileByStoredName,
  isRoomMember,
} = require('./db');
const { initSocket } = require('./socket');
const { getOnlineUserIds } = require('./socket/presenceHandler');
const msManager = require('./voice/mediasoupManager');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const fileRoutes = require('./routes/files');
const dmRoutes = require('./routes/dm');
const voiceRoutes = require('./routes/voice');
const assetRoutes = require('./routes/assets');
const addonRoutes = require('./routes/addons');
const keyRoutes = require('./routes/keys');
const guildRoutes = require('./routes/guilds');
const devDashboardRoutes = require('./routes/devDashboard');
const runtimeMetrics = require('./monitoring/runtimeMetrics');

const PORT = process.env.PORT || 3001;
const HTTP_REDIRECT_PORT = process.env.HTTP_REDIRECT_PORT
  ? Number(process.env.HTTP_REDIRECT_PORT)
  : null;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || '';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || '';
const TLS_CA_PATH = process.env.TLS_CA_PATH || '';
const clientVersionPath = path.join(__dirname, '..', 'client-version.json');

function loadTlsOptions() {
  if (!TLS_KEY_PATH && !TLS_CERT_PATH) {
    return null;
  }
  if (!TLS_KEY_PATH || !TLS_CERT_PATH) {
    throw new Error('Both TLS_KEY_PATH and TLS_CERT_PATH are required to enable HTTPS');
  }

  const options = {
    key: fs.readFileSync(TLS_KEY_PATH),
    cert: fs.readFileSync(TLS_CERT_PATH),
  };

  if (TLS_CA_PATH) {
    options.ca = fs.readFileSync(TLS_CA_PATH);
  }

  return options;
}

const tlsOptions = loadTlsOptions();
const HTTPS_ENABLED = !!tlsOptions;

function readClientVersion() {
  try {
    return JSON.parse(fs.readFileSync(clientVersionPath, 'utf8'));
  } catch {
    return { version: '0.0.0' };
  }
}

function normalizePlatform(rawPlatform = '') {
  const platform = String(rawPlatform || '').trim().toLowerCase();
  switch (platform) {
    case 'darwin':
    case 'mac':
    case 'macos':
    case 'osx':
      return 'darwin-arm64';
    case 'win32':
    case 'windows':
      return 'win32-x64';
    default:
      return platform;
  }
}

function resolveVersionInfoForPlatform(versionInfo, rawPlatform = '') {
  const normalizedPlatform = normalizePlatform(rawPlatform);
  const {
    platformOverrides,
    ...baseVersionInfo
  } = (versionInfo && typeof versionInfo === 'object') ? versionInfo : { version: '0.0.0' };

  if (!platformOverrides || typeof platformOverrides !== 'object') {
    return baseVersionInfo;
  }

  const override = platformOverrides[normalizedPlatform];
  if (!override || typeof override !== 'object') {
    return baseVersionInfo;
  }

  return {
    ...baseVersionInfo,
    ...override,
  };
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Register modern MIME types not known to older mime@1.x (used by express.static)
const mime = require('mime');
mime.define({ 'image/avif': ['avif'] });

const app = express();
app.set('trust proxy', true);

const server = HTTPS_ENABLED
  ? https.createServer(tlsOptions, app)
  : http.createServer(app);

function getRequestProtocol(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  if (typeof forwardedProto === 'string' && forwardedProto.trim()) {
    return forwardedProto.split(',')[0].trim();
  }
  if (req.secure || req.socket?.encrypted) {
    return 'https';
  }
  return 'http';
}

function buildHttpsRedirectUrl(req) {
  const hostHeader = req.get('x-forwarded-host') || req.get('host') || 'localhost';
  const normalizedHost = HTTP_REDIRECT_PORT && Number(PORT) !== 443
    ? hostHeader.replace(/:\d+$/, `:${PORT}`)
    : (Number(PORT) === 443 ? hostHeader.replace(/:\d+$/, '') : hostHeader);
  return `https://${normalizedHost}${req.url}`;
}

app.use((req, res, next) => {
  const requestUrl = req.originalUrl || req.url || '';
  if (requestUrl.startsWith('/api/dev/')) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  runtimeMetrics.beginHttpRequest();

  let finished = false;
  const finalize = () => {
    if (finished) return;
    finished = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    runtimeMetrics.endHttpRequest({
      method: req.method,
      url: requestUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  };

  res.on('finish', finalize);
  res.on('close', finalize);
  next();
});

// CORS: allow Electron (file:// sends null origin), localhost dev, and env-configured origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

function isAllowedOrigin(origin) {
  // No Origin header (undefined) = Electron file://, curl, same-origin â€” allow.
  // Reject the string "null" which comes from sandboxed iframes (potential bypass).
  if (origin === undefined) return true;
  // Localhost dev
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Electron custom protocols
  if (/^(app|file):\/\//.test(origin)) return true;
  // Explicitly allowed origins from env
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
  maxHttpBufferSize: 5e6, // 5MB â€” sufficient for encrypted messages + key distribution
});

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      mediaSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  // HSTS: enforce HTTPS in production
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));
app.use(cors(corsOptions));

// Redirect HTTP to HTTPS in production (when behind a reverse proxy that sets x-forwarded-proto)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (getRequestProtocol(req) === 'http' && (HTTPS_ENABLED || req.headers['x-forwarded-proto'])) {
      return res.redirect(308, buildHttpsRedirectUrl(req));
    }
    next();
  });
}

// Global REST rate limiter â€” prevents brute-force and abuse across all endpoints
const _globalRateLimit = new Map();
const GLOBAL_RL_WINDOW = 60000; // 1 minute
const GLOBAL_RL_MAX = Number(process.env.GLOBAL_RL_MAX || 1000); // max requests per IP per minute

function isLoopbackIp(ip = '') {
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');
}

function canAccessUploadedFile(file, userId) {
  if (!file || !userId) return false;
  if (file.uploaded_by === userId) return true;
  if (!file.message_id) return false;
  if (file.room_id) {
    return !!isRoomMember.get(file.room_id, userId);
  }
  if (file.dm_user_a && file.dm_user_b) {
    return file.dm_user_a === userId || file.dm_user_b === userId;
  }
  return false;
}
app.use((req, res, next) => {
  const ip = req.ip;
  if (isLoopbackIp(ip)) return next();
  const now = Date.now();
  const entry = _globalRateLimit.get(ip);
  if (entry && now < entry.resetTime) {
    if (entry.count >= GLOBAL_RL_MAX) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    entry.count++;
  } else {
    _globalRateLimit.set(ip, { count: 1, resetTime: now + GLOBAL_RL_WINDOW });
  }
  next();
});
// Clean up expired global rate limit entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _globalRateLimit) {
    if (now >= entry.resetTime) _globalRateLimit.delete(ip);
  }
}, 120_000);

app.use(express.json({ limit: '1mb' }));
// Uploads require authentication (Bearer header or ?token= query param)
app.use('/uploads', (req, res, next) => {
  const queryToken = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const token = queryToken ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const session = getSession.get(hashToken(token));
  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

  const storedName = path.basename(req.path || '');
  if (storedName && storedName !== '.' && storedName !== path.sep) {
    const upload = getUploadedFileByStoredName.get(storedName);
    if (upload && !canAccessUploadedFile(upload, session.user_id)) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }
  }
  // Allow images to render inline; force download for everything else (stored XSS prevention)
  const ext = path.extname(req.path).toLowerCase();
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico', '.avif']);
  res.setHeader('Content-Disposition', imageExts.has(ext) ? 'inline' : 'attachment');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir));
app.use('/deepfilter', express.static(path.join(__dirname, 'public/deepfilter')));

// Serve update ZIPs
const updatesDir = path.join(__dirname, '..', 'updates');
if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
// Release downloads are public so existing installs can update without needing
// to pass session credentials through the native updater path.
app.use('/updates', express.static(updatesDir));

function buildAbsoluteUrl(req, relativePath) {
  const protocol = getRequestProtocol(req);
  return `${protocol}://${req.get('host')}${relativePath}`;
}

function resolveUpdateArtifact(relativePath) {
  const filename = relativePath.replace(/^\/updates\//, '');
  const absolutePath = path.join(updatesDir, filename);
  return fs.existsSync(absolutePath) ? relativePath : null;
}

function buildUpdateDownloads(req, version) {
  const darwinInstallerPath = resolveUpdateArtifact(`/updates/guild-${version}-arm64.dmg`);
  const darwinArchivePath = resolveUpdateArtifact(`/updates/guild-darwin-arm64-${version}.zip`);
  const windowsArchivePath = resolveUpdateArtifact(`/updates/guild-win32-x64-${version}.zip`);

  return {
    'darwin-arm64': {
      label: 'Mac Apple Silicon',
      installerUrl: darwinInstallerPath ? buildAbsoluteUrl(req, darwinInstallerPath) : null,
      archiveUrl: darwinArchivePath ? buildAbsoluteUrl(req, darwinArchivePath) : null,
    },
    'win32-x64': {
      label: 'Windows 10 x64',
      installerUrl: windowsArchivePath ? buildAbsoluteUrl(req, windowsArchivePath) : null,
      archiveUrl: windowsArchivePath ? buildAbsoluteUrl(req, windowsArchivePath) : null,
    },
  };
}

function resolveUpdateDelivery(platform, downloads) {
  const platformDownload = downloads?.[platform] || null;
  const hasNativeArchive = Boolean(platformDownload?.archiveUrl);

  if (hasNativeArchive) {
    return {
      updateStrategy: 'native',
      manualInstallReason: null,
    };
  }

  return {
    updateStrategy: 'manual-install',
    manualInstallReason: 'Direct download is required until an auto-update archive is published for this platform.',
  };
}

app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const requestedPlatform = normalizePlatform(req.query.platform);
  const versionInfo = resolveVersionInfoForPlatform(readClientVersion(), requestedPlatform);
  const version = versionInfo?.version || '0.0.0';
  const downloads = buildUpdateDownloads(req, version);
  const delivery = resolveUpdateDelivery(requestedPlatform, downloads);
  res.json({
    ...versionInfo,
    ...delivery,
    downloadPageUrl: buildAbsoluteUrl(req, '/download'),
    downloads,
  });
});

app.get('/download', (req, res) => {
  const versionInfo = readClientVersion();
  const version = versionInfo?.version || '0.0.0';
  const downloads = buildUpdateDownloads(req, version);

  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>/guild Downloads</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #070a07;
        --panel: rgba(10, 18, 10, 0.92);
        --panel-border: rgba(24, 88, 33, 0.55);
        --text: #e7efe7;
        --muted: #8ea392;
        --accent: #ff7a00;
        --success: #3cff68;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background:
          radial-gradient(circle at top, rgba(24, 88, 33, 0.22), transparent 45%),
          linear-gradient(180deg, #081008 0%, var(--bg) 100%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(720px, 100%);
        padding: 32px;
        border-radius: 24px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.36);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 38px;
        line-height: 1.05;
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.5;
      }
      .version {
        color: var(--success);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 12px;
        margin-bottom: 14px;
      }
      .grid {
        display: grid;
        gap: 16px;
        margin-top: 26px;
      }
      .download {
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(24, 88, 33, 0.65);
        background: rgba(8, 14, 8, 0.92);
      }
      .download h2 {
        margin: 0 0 6px;
        font-size: 20px;
      }
      .download p {
        margin-bottom: 14px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 12px;
        border: 1px solid rgba(255, 122, 0, 0.28);
        background: rgba(255, 122, 0, 0.12);
        color: var(--accent);
        text-decoration: none;
        font-weight: 700;
      }
      .button.secondary {
        border-color: rgba(60, 255, 104, 0.24);
        background: rgba(60, 255, 104, 0.08);
        color: var(--success);
      }
      .footnote {
        margin-top: 22px;
        font-size: 13px;
      }
      .empty {
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px dashed rgba(255, 122, 0, 0.28);
        background: rgba(18, 12, 5, 0.6);
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="version">Version ${version}</div>
      <h1>/guild downloads</h1>
      <p>If the in-app updater stalls on extracting files, install the latest build directly from here once. After that, future updates will use the newer updater path.</p>
      <section class="grid">
        ${downloads['darwin-arm64'].installerUrl || downloads['darwin-arm64'].archiveUrl ? `
        <article class="download">
          <h2>${downloads['darwin-arm64'].label}</h2>
          <p>Recommended for Apple Silicon Macs.</p>
          <div class="actions">
            ${downloads['darwin-arm64'].installerUrl ? `<a class="button" href="${downloads['darwin-arm64'].installerUrl}">Download DMG</a>` : ''}
            ${downloads['darwin-arm64'].archiveUrl ? `<a class="button secondary" href="${downloads['darwin-arm64'].archiveUrl}">Download ZIP</a>` : ''}
          </div>
        </article>` : ''}
        ${downloads['win32-x64'].installerUrl ? `
        <article class="download">
          <h2>${downloads['win32-x64'].label}</h2>
          <p>Direct install package for Windows.</p>
          <div class="actions">
            <a class="button" href="${downloads['win32-x64'].installerUrl}">Download ZIP</a>
          </div>
        </article>` : ''}
        ${!downloads['darwin-arm64'].installerUrl && !downloads['darwin-arm64'].archiveUrl && !downloads['win32-x64'].installerUrl ? `
        <article class="empty">
          No release downloads have been published for this version yet.
        </article>` : ''}
      </section>
      <p class="footnote">Install the new build over the existing app. Your account and server settings stay with the app profile on disk.</p>
    </main>
  </body>
</html>`);
});

app.use('/api/dev', devDashboardRoutes);

// Routes
app.use('/api/auth', authRoutes);
roomRoutes.setIO = (ioInstance) => { roomRoutes._io = ioInstance; };
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/addons', addonRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/guilds', guildRoutes);

// Provide online user info to REST routes
userRoutes.setOnlineProvider(getOnlineUserIds);
userRoutes._io = io;
roomRoutes.setIO(io);
voiceRoutes._io = io;
assetRoutes._io = io;
addonRoutes._io = io;
guildRoutes._io = io;


// Initialize Socket.IO
initSocket(io);

function createHttpRedirectServer() {
  if (!HTTPS_ENABLED || !HTTP_REDIRECT_PORT || Number(HTTP_REDIRECT_PORT) === Number(PORT)) {
    return null;
  }

  return http.createServer((req, res) => {
    const hostHeader = req.headers.host || 'localhost';
    const redirectHost = Number(PORT) === 443
      ? hostHeader.replace(/:\d+$/, '')
      : hostHeader.replace(/:\d+$/, `:${PORT}`);
    res.writeHead(308, {
      Location: `https://${redirectHost}${req.url || '/'}`,
    });
    res.end();
  });
}

const httpRedirectServer = createHttpRedirectServer();

// Start server (mediasoup workers optional)
(async () => {
  // Clear stale voice sessions from previous runs
  clearAllVoiceSessions.run();

  try {
    await msManager.createWorkers();
  } catch (err) {
    console.warn(`[mediasoup] Workers unavailable â€” voice/video disabled: ${err.message}`);
  }
  server.listen(PORT, () => {
    const protocol = HTTPS_ENABLED ? 'https' : 'http';
    console.log(`Messenger server running on ${protocol}://localhost:${PORT}`);
  });
  if (httpRedirectServer) {
    httpRedirectServer.listen(HTTP_REDIRECT_PORT, () => {
      console.log(`HTTP redirect server running on http://localhost:${HTTP_REDIRECT_PORT}`);
    });
  }

  // Clean up expired asset dumps every 10 minutes
  setInterval(() => {
    const expired = getExpiredAssetDumps.all();
    if (expired.length > 0) {
      for (const asset of expired) {
        const filePath = path.join(uploadsDir, path.basename(asset.file_url));
        try { fs.unlinkSync(filePath); } catch (e) { /* already gone */ }
      }
      deleteExpiredAssetDumps.run();
      io.emit('asset:expired', { assetIds: expired.map(a => a.id) });
      console.log(`Cleaned up ${expired.length} expired asset dump(s)`);
    }
  }, 10 * 60 * 1000);

  // Clean up expired sessions every hour
  setInterval(() => {
    deleteExpiredSessions.run();
  }, 60 * 60 * 1000);

  // Clean up stale unclaimed encrypted uploads every hour
  setInterval(() => {
    const staleUploads = getExpiredUnclaimedUploadedFiles.all();
    if (staleUploads.length === 0) return;
    for (const upload of staleUploads) {
      const filePath = path.join(uploadsDir, path.basename(upload.stored_name));
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    deleteExpiredUnclaimedUploadedFiles.run();
  }, 60 * 60 * 1000);
})();
