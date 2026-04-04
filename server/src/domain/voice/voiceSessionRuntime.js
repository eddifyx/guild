function createVoiceSessionRuntime({
  addVoiceSession,
  clearChannelVoiceSessions,
  removeUserFromAllVoiceChannels,
  getUserVoiceSession,
  getUserById,
  updateVoiceMuteState,
  getVoiceChannelById,
  getGuildMembers,
  runtimeMetrics,
  msManager,
} = {}) {
  const voiceState = new Map();

  function getChannelState(channelId, autoCreate = false) {
    if (!voiceState.has(channelId)) {
      if (!autoCreate) return null;
      voiceState.set(channelId, new Map());
    }
    return voiceState.get(channelId);
  }

  function buildChannelUpdate(channelId) {
    const channelUsers = getChannelState(channelId, false);
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

  function emitChannelUpdate(io, channelId) {
    const update = buildChannelUpdate(channelId);
    const channel = getVoiceChannelById.get(channelId);
    if (!channel || !channel.guild_id) return;
    const members = getGuildMembers.all(channel.guild_id);
    for (const member of members) {
      io.to(`user:${member.id}`).emit('voice:channel-update', update);
    }
  }

  function getLiveChannelParticipants(channelId) {
    const channelUsers = getChannelState(channelId, false);
    if (!channelUsers) return null;
    return buildChannelUpdate(channelId).participants;
  }

  function getUserLiveVoiceChannelIds(userId) {
    const channelIds = [];
    for (const [channelId, channelUsers] of voiceState.entries()) {
      if (channelUsers.has(userId)) {
        channelIds.push(channelId);
      }
    }
    return channelIds;
  }

  function getUserActiveVoiceChannelId(userId) {
    return getUserLiveVoiceChannelIds(userId)[0] || getUserVoiceSession.get(userId)?.channel_id || null;
  }

  function hasLiveVoiceSession(channelId, userId) {
    const channelUsers = getChannelState(channelId, false);
    return !!channelUsers?.has(userId);
  }

  function markUserJoinedChannel(io, socket, channelId, userId) {
    removeUserFromAllVoiceChannels.run(userId);
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
    return buildChannelUpdate(channelId).participants;
  }

  async function leaveVoiceChannel(io, socket, channelId, userId) {
    socket.leave(`voice:${channelId}`);
    msManager.removePeer(channelId, userId);
    removeUserFromAllVoiceChannels.run(userId);

    const channelUsers = getChannelState(channelId, false);
    if (channelUsers) {
      channelUsers.delete(userId);
      if (channelUsers.size === 0) voiceState.delete(channelId);
    }

    emitChannelUpdate(io, channelId);
    runtimeMetrics.recordVoiceLeave({ channelId, userId });
  }

  async function cleanupUserVoiceSessions(io, socket, userId, fallbackChannelId = null) {
    const channelIds = Array.from(new Set([
      ...getUserLiveVoiceChannelIds(userId),
      fallbackChannelId,
    ].filter(Boolean)));

    if (channelIds.length === 0) {
      removeUserFromAllVoiceChannels.run(userId);
      return false;
    }

    for (const channelId of channelIds) {
      await leaveVoiceChannel(io, socket, channelId, userId);
    }

    return true;
  }

  function destroyLiveVoiceChannel(io, channelId, reason = 'channel-destroyed') {
    if (!channelId) return;
    clearChannelVoiceSessions.run(channelId);

    const channelUsers = getChannelState(channelId, false);
    if (channelUsers) {
      const affectedUserIds = Array.from(channelUsers.keys());
      voiceState.delete(channelId);
      for (const affectedUserId of affectedUserIds) {
        runtimeMetrics.recordVoiceLeave({ channelId, userId: affectedUserId, reason });
      }
    }

    if (io) {
      io.in(`voice:${channelId}`).socketsLeave(`voice:${channelId}`);
    }

    try {
      msManager.removeRoom(channelId);
    } catch (err) {
      runtimeMetrics.recordVoiceError('voice:destroy-channel', {
        channelId,
        message: err?.message || String(err),
      });
      console.warn(`[Voice] Failed to remove mediasoup room for channel ${channelId}:`, err);
    }
  }

  function updateMuteState(channelId, userId, muted) {
    const channelUsers = getChannelState(channelId, false);
    if (!channelUsers) return null;
    const userState = channelUsers.get(userId);
    if (!userState) return null;

    userState.muted = !!muted;
    updateVoiceMuteState.run(userState.muted ? 1 : 0, userState.deafened ? 1 : 0, channelId, userId);
    return {
      channelId,
      userId,
      muted: userState.muted,
      deafened: userState.deafened,
    };
  }

  function updateDeafenState(channelId, userId, deafened) {
    const channelUsers = getChannelState(channelId, false);
    if (!channelUsers) return null;
    const userState = channelUsers.get(userId);
    if (!userState) return null;

    userState.deafened = !!deafened;
    if (userState.deafened) userState.muted = true;
    updateVoiceMuteState.run(userState.muted ? 1 : 0, userState.deafened ? 1 : 0, channelId, userId);
    return {
      channelId,
      userId,
      muted: userState.muted,
      deafened: userState.deafened,
    };
  }

  function updateSpeakingState(channelId, userId, speaking) {
    const channelUsers = getChannelState(channelId, false);
    if (!channelUsers) return null;
    const userState = channelUsers.get(userId);
    if (!userState) return null;

    userState.speaking = !!speaking;
    return { userId, speaking: userState.speaking };
  }

  function updateScreenShareState(channelId, userId, sharing) {
    const channelUsers = getChannelState(channelId, false);
    if (!channelUsers) return false;
    const userState = channelUsers.get(userId);
    if (!userState) return false;

    userState.screenSharing = !!sharing;
    return true;
  }

  return {
    buildChannelUpdate,
    cleanupUserVoiceSessions,
    destroyLiveVoiceChannel,
    emitChannelUpdate,
    getLiveChannelParticipants,
    getUserActiveVoiceChannelId,
    getUserLiveVoiceChannelIds,
    hasLiveVoiceSession,
    markUserJoinedChannel,
    updateDeafenState,
    updateMuteState,
    updateScreenShareState,
    updateSpeakingState,
  };
}

module.exports = {
  createVoiceSessionRuntime,
};
