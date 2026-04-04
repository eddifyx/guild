const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getLiveChannelParticipants, destroyLiveVoiceChannel } = require('../socket/voiceHandler');
const msManager = require('../voice/mediasoupManager');
const {
  createVoiceChannel,
  getAllVoiceChannels,
  getVoiceChannelById,
  getVoiceChannelsByGuild,
  updateVoiceChannelName,
  deleteVoiceChannel,
  clearChannelVoiceSessions,
  getVoiceChannelParticipants,
  isGuildMember,
  getGuildMembers,
} = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { hasGuildPermission } = require('../utils/permissions');

const router = express.Router();
router.use(authMiddleware);

function normalizeParticipants(rows) {
  return rows.map((participant) => ({
    userId: participant.user_id,
    username: participant.username,
    avatarColor: participant.avatar_color,
    npub: participant.npub || null,
    muted: !!participant.is_muted,
    deafened: !!participant.is_deafened,
    speaking: false,
    screenSharing: false,
  }));
}

function emitToGuildMembers(io, guildId, event, payload, extraUserIds = []) {
  if (!io || !guildId) return;
  const targetUserIds = new Set([
    ...getGuildMembers.all(guildId).map((member) => member.id),
    ...extraUserIds.filter(Boolean),
  ]);
  for (const userId of targetUserIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

function getVoiceAvailabilityStatus() {
  const stats = typeof msManager.getStatsSnapshot === 'function'
    ? msManager.getStatsSnapshot()
    : {};
  const workerCount = Number(stats.workerCount) || 0;
  const targetWorkerCount = Number(stats.targetWorkerCount) || workerCount || 0;
  const workersAvailable = stats.workersAvailable !== false && workerCount > 0;
  const degraded = !!stats.degraded || (targetWorkerCount > 0 && workerCount < targetWorkerCount);
  const recoveryPending = !!stats.recoveryPending;

  let status = 'ok';
  if (!workersAvailable) {
    status = recoveryPending ? 'recovering' : 'unavailable';
  } else if (recoveryPending) {
    status = 'recovering';
  } else if (degraded) {
    status = 'degraded';
  }

  return {
    status,
    workerCount,
    targetWorkerCount,
    workersAvailable,
    degraded,
    recoveryPending,
  };
}

router.get('/status', (_req, res) => {
  res.json(getVoiceAvailabilityStatus());
});

router.get('/channels', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId is required' });
  const membership = isGuildMember.get(guildId, req.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this guild' });
  const channels = getVoiceChannelsByGuild.all(guildId);
  const result = channels.map((channel) => {
    const participants = getLiveChannelParticipants(channel.id)
      ?? normalizeParticipants(getVoiceChannelParticipants.all(channel.id));
    return { ...channel, participants };
  });
  res.json(result);
});

const MAX_CHANNELS_PER_USER = 20;

router.post('/channels', (req, res) => {
  const { name, guildId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or less' });

  const allChannels = getAllVoiceChannels.all();
  const userChannelCount = allChannels.filter((channel) => channel.created_by === req.userId).length;
  if (userChannelCount >= MAX_CHANNELS_PER_USER) {
    return res.status(429).json({ error: `Cannot create more than ${MAX_CHANNELS_PER_USER} voice channels` });
  }

  if (!guildId) return res.status(400).json({ error: 'Guild ID is required' });

  const guildMembership = isGuildMember.get(guildId, req.userId);
  if (!guildMembership) return res.status(403).json({ error: 'Not a member of this guild' });

  if (!hasGuildPermission(guildMembership, 'manage_rooms')) {
    return res.status(403).json({ error: 'No permission to create voice channels' });
  }

  const id = uuidv4();
  try {
    createVoiceChannel.run(id, name.trim(), guildId, req.userId);
    const channel = getVoiceChannelById.get(id);
    emitToGuildMembers(router._io, guildId, 'voice:channel-created', { ...channel, participants: [] });
    res.status(201).json(channel);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Channel name already exists' });
    }
    throw err;
  }
});

router.patch('/channels/:id', (req, res) => {
  const channel = getVoiceChannelById.get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const nextName = String(req.body?.name || '').trim();
  if (!nextName) return res.status(400).json({ error: 'Name required' });
  if (nextName.length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or less' });

  const guildMembership = channel.guild_id ? isGuildMember.get(channel.guild_id, req.userId) : null;
  if (!guildMembership) {
    return res.status(403).json({ error: 'Not a member of this guild' });
  }
  if (channel.created_by !== req.userId && guildMembership.rank_order !== 0) {
    return res.status(403).json({ error: 'Only the channel creator or Guild Master can rename it' });
  }

  try {
    updateVoiceChannelName.run(nextName, req.params.id);
    const updatedChannel = getVoiceChannelById.get(req.params.id);
    emitToGuildMembers(router._io, channel.guild_id, 'voice:channel-renamed', {
      channelId: req.params.id,
      name: updatedChannel.name,
    });
    res.json(updatedChannel);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Channel name already exists' });
    }
    throw err;
  }
});

router.delete('/channels/:id', (req, res) => {
  const channel = getVoiceChannelById.get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const guildMembership = channel.guild_id ? isGuildMember.get(channel.guild_id, req.userId) : null;
  if (!guildMembership) {
    return res.status(403).json({ error: 'Not a member of this guild' });
  }
  if (channel.created_by !== req.userId && guildMembership.rank_order !== 0) {
    return res.status(403).json({ error: 'Only the channel creator or Guild Master can delete it' });
  }

  clearChannelVoiceSessions.run(req.params.id);
  deleteVoiceChannel.run(req.params.id);
  emitToGuildMembers(router._io, channel.guild_id, 'voice:channel-deleted', { channelId: req.params.id });
  destroyLiveVoiceChannel(router._io, req.params.id, 'channel-deleted');

  res.json({ ok: true });
});

module.exports = router;
