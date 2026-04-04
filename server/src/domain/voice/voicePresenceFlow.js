function createVoicePresenceFlow({
  io,
  socket,
  userId,
  voiceRuntime,
  getUserVoiceSession,
  msManager,
  runtimeMetrics,
  getVoiceSocketError,
  rejectInvalidVoicePayload,
  validateVoiceConsumerQualityPayload,
  validateVoiceToggleMutePayload,
  validateVoiceToggleDeafenPayload,
  validateVoiceSpeakingPayload,
  validateVoiceScreenShareStatePayload,
  validateVoiceLeavePayload,
} = {}) {
  return {
    handleConsumerQuality(payload) {
      const qualityPayload = validateVoiceConsumerQualityPayload(payload);
      if (!qualityPayload.ok) {
        rejectInvalidVoicePayload('voice:consumer-quality', qualityPayload);
        return;
      }
      const {
        channelId,
        producerId,
        ...qualityMetrics
      } = qualityPayload.value;

      if (!voiceRuntime.hasLiveVoiceSession(channelId, userId)) return;

      msManager.updateConsumerQuality(channelId, userId, producerId, qualityMetrics).catch((err) => {
        runtimeMetrics.recordVoiceError('voice:consumer-quality', {
          userId,
          channelId,
          producerId,
          message: err?.message || String(err),
        });
        console.warn('voice:consumer-quality error:', err);
      });
    },

    handleToggleMute(payload) {
      const mutePayload = validateVoiceToggleMutePayload(payload);
      if (!mutePayload.ok) {
        rejectInvalidVoicePayload('voice:toggle-mute', mutePayload);
        return;
      }
      const { channelId, muted } = mutePayload.value;
      const muteUpdate = voiceRuntime.updateMuteState(channelId, userId, muted);
      if (!muteUpdate) return;
      io.to(`voice:${channelId}`).emit('voice:peer-mute-update', muteUpdate);
    },

    handleToggleDeafen(payload) {
      const deafenPayload = validateVoiceToggleDeafenPayload(payload);
      if (!deafenPayload.ok) {
        rejectInvalidVoicePayload('voice:toggle-deafen', deafenPayload);
        return;
      }
      const { channelId, deafened } = deafenPayload.value;
      const muteUpdate = voiceRuntime.updateDeafenState(channelId, userId, deafened);
      if (!muteUpdate) return;
      io.to(`voice:${channelId}`).emit('voice:peer-mute-update', muteUpdate);
    },

    handleSpeaking(payload) {
      const speakingPayload = validateVoiceSpeakingPayload(payload);
      if (!speakingPayload.ok) {
        rejectInvalidVoicePayload('voice:speaking', speakingPayload);
        return;
      }
      const { channelId, speaking } = speakingPayload.value;
      const speakingUpdate = voiceRuntime.updateSpeakingState(channelId, userId, speaking);
      if (!speakingUpdate) return;
      socket.to(`voice:${channelId}`).emit('voice:speaking', speakingUpdate);
    },

    handleScreenShareState(payload) {
      const screenSharePayload = validateVoiceScreenShareStatePayload(payload);
      if (!screenSharePayload.ok) {
        rejectInvalidVoicePayload('voice:screen-share-state', screenSharePayload);
        return;
      }
      const { channelId, sharing } = screenSharePayload.value;
      if (!voiceRuntime.updateScreenShareState(channelId, userId, sharing)) return;
      voiceRuntime.emitChannelUpdate(io, channelId);
    },

    async handleLeave(payload, callback) {
      const leavePayload = validateVoiceLeavePayload(payload);
      if (!leavePayload.ok) {
        rejectInvalidVoicePayload('voice:leave', leavePayload, callback);
        return;
      }
      const { channelId } = leavePayload.value;
      try {
        const activeChannelIds = new Set([
          ...voiceRuntime.getUserLiveVoiceChannelIds(userId),
          getUserVoiceSession.get(userId)?.channel_id,
        ].filter(Boolean));
        if (!activeChannelIds.has(channelId)) {
          if (callback) callback({ ok: false, error: 'Not in this voice channel' });
          return;
        }
        await voiceRuntime.cleanupUserVoiceSessions(io, socket, userId, channelId);
        if (callback) callback({ ok: true });
      } catch (err) {
        console.error('voice:leave error:', err);
        runtimeMetrics.recordVoiceError('voice:leave', { userId, channelId, message: err.message });
        if (callback) callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Leave failed') });
      }
    },

    handleDisconnect() {
      const activeChannelId = voiceRuntime.getUserActiveVoiceChannelId(userId);
      if (!activeChannelId) return;
      voiceRuntime.cleanupUserVoiceSessions(io, socket, userId, activeChannelId).catch((err) => {
        runtimeMetrics.recordVoiceError('voice:disconnect_cleanup', {
          userId,
          channelId: activeChannelId,
          message: err.message,
        });
        console.error(`voice:disconnect cleanup error for user ${userId}:`, err);
      });
    },
  };
}

module.exports = {
  createVoicePresenceFlow,
};
