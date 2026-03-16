const {
  addVoiceSession,
  removeVoiceSession,
  getVoiceChannelParticipants,
  getUserVoiceSession,
  getUserById,
  updateVoiceMuteState,
  getVoiceChannelById,
  isGuildMember,
  getGuildMembers,
} = require('../db');

const msManager = require('../voice/mediasoupManager');
const runtimeMetrics = require('../monitoring/runtimeMetrics');

// In-memory voice state: Map<channelId, Map<userId, { muted, deafened, speaking, screenSharing }>>
const voiceState = new Map();

function getChannelState(channelId, autoCreate = false) {
  if (!voiceState.has(channelId)) {
    if (!autoCreate) return null;
    voiceState.set(channelId, new Map());
  }
  return voiceState.get(channelId);
}

// Emit voice:channel-update only to members of the channel's guild
function emitChannelUpdate(io, channelId) {
  const update = buildChannelUpdate(channelId);
  const channel = getVoiceChannelById.get(channelId);
  if (!channel || !channel.guild_id) return;
  const members = getGuildMembers.all(channel.guild_id);
  for (const member of members) {
    io.to(`user:${member.id}`).emit('voice:channel-update', update);
  }
}

function buildChannelUpdate(channelId) {
  const channelUsers = getChannelState(channelId);
  if (!channelUsers) return { channelId, participants: [] };

  const participants = [];
  for (const [uid, state] of channelUsers) {
    const user = getUserById.get(uid);
    if (!user) continue;
    participants.push({
      userId: uid,
      username: user.username,
      avatarColor: user.avatar_color,
      npub: user.npub || null,
      muted: state.muted,
      deafened: state.deafened,
      speaking: state.speaking,
      screenSharing: state.screenSharing,
    });
  }

  return { channelId, participants };
}

function getLiveChannelParticipants(channelId) {
  const channelUsers = getChannelState(channelId, false);
  if (!channelUsers) return null;
  return buildChannelUpdate(channelId).participants;
}

function buildProducerPayload({ producerId, producerUserId, kind, source }) {
  return {
    producerId,
    producerUserId,
    kind,
    source,
  };
}

function attachProducerCloseBroadcast(io, channelId, producerMeta) {
  if (!producerMeta?.producer) return;

  const payload = buildProducerPayload(producerMeta);
  let broadcasted = false;
  const broadcastClosed = () => {
    if (broadcasted) return;
    broadcasted = true;
    io.to(`voice:${channelId}`).emit('voice:producer-closed', payload);
  };

  if (producerMeta.producer.observer?.on) {
    producerMeta.producer.observer.on('close', broadcastClosed);
  }
  if (producerMeta.producer.on) {
    producerMeta.producer.on('transportclose', broadcastClosed);
  }
}

async function leaveVoiceChannel(io, socket, channelId, userId) {
  socket.leave(`voice:${channelId}`);
  msManager.removePeer(channelId, userId);
  removeVoiceSession.run(channelId, userId);

  const channelUsers = getChannelState(channelId);
  if (channelUsers) {
    channelUsers.delete(userId);
    if (channelUsers.size === 0) voiceState.delete(channelId);
  }

  emitChannelUpdate(io, channelId);
  runtimeMetrics.recordVoiceLeave({ channelId, userId });
}

function handleVoice(io, socket) {
  const { userId } = socket.handshake.auth;

  socket.on('voice:join', async ({ channelId }, callback) => {
    if (typeof callback !== 'function') return;

    try {
      const voiceChannel = channelId ? getVoiceChannelById.get(channelId) : null;
      if (!voiceChannel) {
        return callback({ ok: false, error: 'Voice channel not found' });
      }

      if (voiceChannel.guild_id && !isGuildMember.get(voiceChannel.guild_id, userId)) {
        return callback({ ok: false, error: 'Not a member of this guild' });
      }

      const existing = getUserVoiceSession.get(userId);
      if (existing) {
        await leaveVoiceChannel(io, socket, existing.channel_id, userId);
      }

      const room = await msManager.getOrCreateRoom(channelId);
      const rtpCapabilities = room.router.rtpCapabilities;

      addVoiceSession.run(channelId, userId);
      const channelUsers = getChannelState(channelId, true);
      channelUsers.set(userId, {
        muted: false,
        deafened: false,
        speaking: false,
        screenSharing: false,
      });

      socket.join(`voice:${channelId}`);
      emitChannelUpdate(io, channelId);

      const existingProducers = [];
      for (const peerId of msManager.getRoomPeers(channelId)) {
        if (peerId === userId) continue;
        existingProducers.push(...msManager.getProducersForPeer(channelId, peerId));
      }

      callback({
        ok: true,
        rtpCapabilities,
        existingProducers,
        participants: buildChannelUpdate(channelId).participants,
      });
      runtimeMetrics.recordVoiceJoin({ channelId, userId });
    } catch (err) {
      console.error('voice:join error:', err);
      runtimeMetrics.recordVoiceError('voice:join', { userId, message: err.message });
      callback({ ok: false, error: 'Failed to join voice channel' });
    }
  });

  function verifyVoiceSession(channelId, callback) {
    const session = getUserVoiceSession.get(userId);
    if (!session || session.channel_id !== channelId) {
      callback({ ok: false, error: 'Not in this voice channel' });
      return false;
    }
    return true;
  }

  socket.on('voice:create-transport', async ({ channelId, direction }, callback) => {
    if (typeof callback !== 'function') return;
    try {
      if (!verifyVoiceSession(channelId, callback)) return;
      const transportOptions = await msManager.createWebRtcTransport(channelId, userId, direction);
      callback({ ok: true, transportOptions });
    } catch (err) {
      console.error('voice:create-transport error:', err);
      callback({ ok: false, error: 'Transport creation failed' });
    }
  });

  socket.on('voice:connect-transport', async ({ channelId, transportId, dtlsParameters }, callback) => {
    if (typeof callback !== 'function') return;
    try {
      if (!verifyVoiceSession(channelId, callback)) return;
      await msManager.connectTransport(channelId, userId, transportId, dtlsParameters);
      callback({ ok: true });
    } catch (err) {
      console.error('voice:connect-transport error:', err);
      callback({ ok: false, error: 'Transport connection failed' });
    }
  });

  socket.on('voice:produce', async ({ channelId, transportId, kind, rtpParameters, appData }, callback) => {
    if (typeof callback !== 'function') return;

    try {
      if (!verifyVoiceSession(channelId, callback)) return;

      const producerMeta = await msManager.produce(
        channelId,
        userId,
        transportId,
        kind,
        rtpParameters,
        appData,
      );

      attachProducerCloseBroadcast(io, channelId, {
        ...producerMeta,
        producerUserId: userId,
      });

      const payload = buildProducerPayload({
        ...producerMeta,
        producerUserId: userId,
      });

      socket.to(`voice:${channelId}`).emit('voice:new-producer', payload);
      runtimeMetrics.recordVoiceProduce({ channelId, userId, kind, source: producerMeta.source });
      callback({ ok: true, producerId: producerMeta.producerId, source: producerMeta.source });
    } catch (err) {
      console.error('voice:produce error:', err);
      runtimeMetrics.recordVoiceError('voice:produce', { userId, channelId, message: err.message });
      callback({ ok: false, error: 'Produce failed' });
    }
  });

  socket.on('voice:consume', async ({ channelId, producerId, producerUserId, rtpCapabilities }, callback) => {
    if (typeof callback !== 'function') return;
    try {
      if (!verifyVoiceSession(channelId, callback)) return;
      const consumerData = await msManager.consume(channelId, userId, producerUserId, producerId, rtpCapabilities);
      runtimeMetrics.recordVoiceConsume({ channelId, userId, producerUserId, producerId });
      callback({ ok: true, ...consumerData });
    } catch (err) {
      console.error('voice:consume error:', err);
      runtimeMetrics.recordVoiceError('voice:consume', { userId, channelId, message: err.message });
      callback({ ok: false, error: 'Consume failed' });
    }
  });

  socket.on('voice:toggle-mute', (data) => {
    if (!data || !data.channelId) return;
    const { channelId, muted } = data;
    const channelUsers = getChannelState(channelId);
    if (!channelUsers) return;
    const userState = channelUsers.get(userId);
    if (!userState) return;

    userState.muted = !!muted;
    updateVoiceMuteState.run(userState.muted ? 1 : 0, userState.deafened ? 1 : 0, channelId, userId);
    io.to(`voice:${channelId}`).emit('voice:peer-mute-update', {
      channelId,
      userId,
      muted: userState.muted,
      deafened: userState.deafened,
    });
  });

  socket.on('voice:toggle-deafen', (data) => {
    if (!data || !data.channelId) return;
    const { channelId, deafened } = data;
    const channelUsers = getChannelState(channelId);
    if (!channelUsers) return;
    const userState = channelUsers.get(userId);
    if (!userState) return;

    userState.deafened = !!deafened;
    if (userState.deafened) userState.muted = true;
    updateVoiceMuteState.run(userState.muted ? 1 : 0, userState.deafened ? 1 : 0, channelId, userId);
    io.to(`voice:${channelId}`).emit('voice:peer-mute-update', {
      channelId,
      userId,
      muted: userState.muted,
      deafened: userState.deafened,
    });
  });

  socket.on('voice:speaking', (data) => {
    if (!data || !data.channelId) return;
    const { channelId, speaking } = data;
    const channelUsers = getChannelState(channelId);
    if (!channelUsers) return;
    const userState = channelUsers.get(userId);
    if (!userState) return;

    userState.speaking = !!speaking;
    socket.to(`voice:${channelId}`).emit('voice:speaking', { userId, speaking: userState.speaking });
  });

  socket.on('voice:screen-share-state', (data) => {
    if (!data || !data.channelId) return;
    const { channelId, sharing } = data;
    const channelUsers = getChannelState(channelId);
    if (!channelUsers) return;
    const userState = channelUsers.get(userId);
    if (!userState) return;

    userState.screenSharing = !!sharing;
    emitChannelUpdate(io, channelId);
  });

  socket.on('voice:leave', async ({ channelId }, callback) => {
    try {
      const session = getUserVoiceSession.get(userId);
      if (!session || session.channel_id !== channelId) {
        if (callback) callback({ ok: false, error: 'Not in this voice channel' });
        return;
      }
      await leaveVoiceChannel(io, socket, channelId, userId);
      if (callback) callback({ ok: true });
    } catch (err) {
      console.error('voice:leave error:', err);
      runtimeMetrics.recordVoiceError('voice:leave', { userId, channelId, message: err.message });
      if (callback) callback({ ok: false, error: 'Leave failed' });
    }
  });

  socket.on('disconnect', () => {
    const existing = getUserVoiceSession.get(userId);
    if (!existing) return;
    leaveVoiceChannel(io, socket, existing.channel_id, userId).catch((err) => {
      runtimeMetrics.recordVoiceError('voice:disconnect_cleanup', {
        userId,
        channelId: existing.channel_id,
        message: err.message,
      });
      console.error(`voice:disconnect cleanup error for user ${userId}:`, err);
    });
  });
}

module.exports = { handleVoice, getLiveChannelParticipants };
