const express = require('express');
const http = require('http');
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

const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Register modern MIME types not known to older mime@1.x (used by express.static)
const mime = require('mime');
mime.define({ 'image/avif': ['avif'] });

const app = express();
const server = http.createServer(app);

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
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
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
// Updates require authentication to prevent unauthorized downloads
app.use('/updates', (req, res, next) => {
  const token = req.query.token ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const session = getSession.get(hashToken(token));
  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
  next();
}, express.static(updatesDir));

// Client version check
const clientVersion = require('../client-version.json');
app.get('/api/version', (req, res) => {
  res.json(clientVersion);
});

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
roomRoutes.setIO(io);
voiceRoutes._io = io;
assetRoutes._io = io;
addonRoutes._io = io;
guildRoutes._io = io;


// Initialize Socket.IO
initSocket(io);

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
    console.log(`Messenger server running on http://localhost:${PORT}`);
  });

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
