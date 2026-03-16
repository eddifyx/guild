const express = require('express');
const { db, getAllVoiceChannels } = require('../db');
const { getOnlineUserIds } = require('../socket/presenceHandler');
const { getLiveChannelParticipants } = require('../socket/voiceHandler');
const msManager = require('../voice/mediasoupManager');
const runtimeMetrics = require('../monitoring/runtimeMetrics');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const clientVersionPath = path.join(__dirname, '..', '..', 'client-version.json');

function readClientVersion() {
  try {
    return JSON.parse(fs.readFileSync(clientVersionPath, 'utf8'));
  } catch {
    return { version: '0.0.0' };
  }
}

const getDbCounts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM sessions WHERE expires_at > datetime('now')) AS active_sessions,
    (SELECT COUNT(*) FROM guilds) AS guilds,
    (SELECT COUNT(*) FROM guild_members) AS guild_memberships,
    (SELECT COUNT(*) FROM rooms) AS rooms,
    (SELECT COUNT(*) FROM voice_channels) AS voice_channels,
    (SELECT COUNT(*) FROM messages) AS messages,
    (SELECT COUNT(*) FROM dm_conversations) AS dm_conversations,
    (SELECT COUNT(*) FROM uploaded_files) AS uploaded_files,
    (SELECT COUNT(*) FROM attachments) AS attachments,
    (SELECT COUNT(*) FROM asset_dumps) AS asset_dumps,
    (SELECT COUNT(*) FROM addons) AS addons
`);

const getRecentDbCounts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-24 hours')) AS new_users_24h,
    (SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-5 minutes')) AS messages_5m,
    (SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-1 hour')) AS messages_1h,
    (SELECT COUNT(*) FROM uploaded_files WHERE created_at >= datetime('now', '-24 hours')) AS uploads_24h,
    (SELECT COUNT(*) FROM asset_dumps WHERE created_at >= datetime('now', '-24 hours')) AS asset_dumps_24h,
    (SELECT COUNT(*) FROM addons WHERE created_at >= datetime('now', '-24 hours')) AS addons_24h
`);

function isLoopbackIp(ip = '') {
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');
}

function getProvidedKey(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const headerKey = req.headers['x-dev-dashboard-key'];
  return typeof headerKey === 'string' ? headerKey.trim() : '';
}

function requireDashboardAccess(req, res, next) {
  const expectedKey = process.env.DEV_DASHBOARD_KEY || '';
  const providedKey = getProvidedKey(req);

  if (expectedKey) {
    if (providedKey === expectedKey) return next();
    return res.status(401).json({ error: 'Invalid dashboard credentials' });
  }

  if (isLoopbackIp(req.ip)) return next();
  return res.status(403).json({
    error: 'Dashboard access is loopback-only until DEV_DASHBOARD_KEY is set',
  });
}

function buildVoiceSnapshot() {
  const channels = [];
  let activeParticipants = 0;
  let activeSpeakers = 0;
  let activeScreenShares = 0;

  for (const channel of getAllVoiceChannels.all()) {
    const participants = getLiveChannelParticipants(channel.id) || [];
    if (!participants.length) continue;

    const speakers = participants.filter((participant) => participant.speaking).length;
    const screenShares = participants.filter((participant) => participant.screenSharing).length;

    activeParticipants += participants.length;
    activeSpeakers += speakers;
    activeScreenShares += screenShares;

    channels.push({
      id: channel.id,
      name: channel.name,
      guildId: channel.guild_id || null,
      participants: participants.length,
      speakers,
      screenShares,
    });
  }

  channels.sort((a, b) => b.participants - a.participants || a.name.localeCompare(b.name));

  return {
    activeChannels: channels.length,
    activeParticipants,
    activeSpeakers,
    activeScreenShares,
    channels,
  };
}

function buildApplicationContext() {
  return {
    appName: '/guild',
    environment: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3001),
    clientVersion: readClientVersion(),
    onlineUsers: getOnlineUserIds().size,
    voice: buildVoiceSnapshot(),
    mediasoup: typeof msManager.getStatsSnapshot === 'function'
      ? msManager.getStatsSnapshot()
      : {
        workerCount: 0,
        roomCount: 0,
        peerCount: 0,
        transportCount: 0,
        producerCount: 0,
        consumerCount: 0,
      },
    db: {
      counts: getDbCounts.get(),
      recent: getRecentDbCounts.get(),
    },
  };
}

router.use(requireDashboardAccess);

router.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(runtimeMetrics.getHealthSnapshot(buildApplicationContext()));
});

router.get('/metrics', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(runtimeMetrics.getSnapshot(buildApplicationContext()));
});

module.exports = router;
