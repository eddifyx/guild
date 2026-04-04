const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const {
  loadTlsOptions,
  readClientVersion,
  normalizePlatform,
  resolveVersionInfoForPlatform,
  getRequestProtocol,
  buildHttpsRedirectUrl,
  isAllowedOrigin,
  isLoopbackIp,
  canAccessUploadedFile,
  buildAbsoluteUrl,
  buildUpdateDownloads,
  resolveUpdateDelivery,
} = require('./startup/serverRuntimeModel');
const {
  buildDownloadPageState,
  buildDownloadPageHtml,
} = require('./startup/downloadPageModel');
const {
  createRequestMetricsMiddleware,
  createGlobalRateLimitMiddleware,
  scheduleRateLimitCleanup,
  createHttpRedirectServer,
} = require('./startup/serverHttpRuntime');
const {
  attachApiRoutes,
  bindRealtimeProviders,
} = require('./startup/serverRouteBindings');
const {
  createServerMaintenanceRuntime,
} = require('./startup/serverMaintenanceRuntime');

const {
  clearAllVoiceSessions,
  getExpiredAssetDumps,
  deleteExpiredAssetDumps,
  deleteExpiredSessions,
  getExpiredUnclaimedUploadedFiles,
  deleteExpiredUnclaimedUploadedFiles,
  getExpiredGuildChatUploadedFiles,
  deleteExpiredGuildChatUploadedFiles,
  getSession,
  hashToken,
  getUploadedFileByStoredName,
  isRoomMember,
  usersShareGuild,
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

const tlsOptions = loadTlsOptions({
  keyPath: TLS_KEY_PATH,
  certPath: TLS_CERT_PATH,
  caPath: TLS_CA_PATH,
  readFileSyncFn: fs.readFileSync,
});
const HTTPS_ENABLED = !!tlsOptions;

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

app.use(createRequestMetricsMiddleware(runtimeMetrics));

// CORS: allow Electron (file:// sends null origin), localhost dev, and env-configured origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin, { allowedOrigins: ALLOWED_ORIGINS })) return callback(null, true);
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
      return res.redirect(308, buildHttpsRedirectUrl(req, {
        httpRedirectPort: HTTP_REDIRECT_PORT,
        appPort: PORT,
      }));
    }
    next();
  });
}

// Global REST rate limiter â€” prevents brute-force and abuse across all endpoints
const globalRateLimitStore = new Map();
const GLOBAL_RL_WINDOW = 60000; // 1 minute
const GLOBAL_RL_MAX = Number(process.env.GLOBAL_RL_MAX || 1000); // max requests per IP per minute

app.use(createGlobalRateLimitMiddleware({
  store: globalRateLimitStore,
  windowMs: GLOBAL_RL_WINDOW,
  maxRequests: GLOBAL_RL_MAX,
  isLoopbackIpFn: isLoopbackIp,
}));
scheduleRateLimitCleanup({
  store: globalRateLimitStore,
});

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
    if (upload && !canAccessUploadedFile(upload, session.user_id, {
      isRoomMemberFn: (roomId, userId) => isRoomMember.get(roomId, userId),
      usersShareGuildFn: (userA, userB) => usersShareGuild.get(userA, userB),
    })) {
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

app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const requestedPlatform = normalizePlatform(req.query.platform);
  const versionInfo = resolveVersionInfoForPlatform(readClientVersion({
    clientVersionPath,
    readFileSyncFn: fs.readFileSync,
  }), requestedPlatform);
  const version = versionInfo?.version || '0.0.0';
  const downloads = buildUpdateDownloads(req, version, {
    updatesDir,
    existsSyncFn: fs.existsSync,
  });
  const delivery = resolveUpdateDelivery(requestedPlatform, downloads);
  res.json({
    ...versionInfo,
    ...delivery,
    downloadPageUrl: buildAbsoluteUrl(req, '/download'),
    downloads,
  });
});

app.get('/download', (req, res) => {
  const versionInfo = readClientVersion({
    clientVersionPath,
    readFileSyncFn: fs.readFileSync,
  });
  const downloadPageState = buildDownloadPageState(req, versionInfo, {
    updatesDir,
    existsSyncFn: fs.existsSync,
  });

  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(buildDownloadPageHtml(downloadPageState));
});

attachApiRoutes(app, {
  devDashboardRoutes,
  authRoutes,
  roomRoutes,
  messageRoutes,
  userRoutes,
  uploadRoutes,
  fileRoutes,
  dmRoutes,
  voiceRoutes,
  assetRoutes,
  addonRoutes,
  keyRoutes,
  guildRoutes,
});

bindRealtimeProviders({
  io,
  getOnlineUserIds,
  userRoutes,
  roomRoutes,
  voiceRoutes,
  assetRoutes,
  addonRoutes,
  guildRoutes,
});


// Initialize Socket.IO
initSocket(io);

const httpRedirectServer = createHttpRedirectServer({
  httpsEnabled: HTTPS_ENABLED,
  httpRedirectPort: HTTP_REDIRECT_PORT,
  appPort: PORT,
});
const maintenanceRuntime = createServerMaintenanceRuntime({
  getExpiredAssetDumps,
  deleteExpiredAssetDumps,
  deleteExpiredSessions,
  getExpiredUnclaimedUploadedFiles,
  deleteExpiredUnclaimedUploadedFiles,
  getExpiredGuildChatUploadedFiles,
  deleteExpiredGuildChatUploadedFiles,
  uploadsDir,
  io,
  unlinkSyncFn: fs.unlinkSync,
});

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

  maintenanceRuntime.schedule();
})();
