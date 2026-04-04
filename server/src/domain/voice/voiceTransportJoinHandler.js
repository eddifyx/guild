const {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  getVoiceSocketError,
  hasAvailableVoiceWorkers,
  listExistingRoomProducers,
  verifyVoiceChannelAccess,
} = require('./voiceTransportSupport');

function createVoiceJoinHandler({
  io,
  socket,
  userId,
  voiceRuntime,
  msManager,
  runtimeMetrics,
  getVoiceChannelById,
  isGuildMember,
  rejectInvalidVoicePayload,
  validateVoiceJoinPayload,
} = {}) {
  return async function handleJoin(payload, callback) {
    if (typeof callback !== 'function') return;
    const joinPayload = validateVoiceJoinPayload(payload);
    if (!joinPayload.ok) {
      rejectInvalidVoicePayload('voice:join', joinPayload, callback);
      return;
    }
    const { channelId } = joinPayload.value;
    runtimeMetrics.recordVoiceEvent('voice:join_requested', { userId, channelId });

    try {
      const accessResult = verifyVoiceChannelAccess({
        channelId,
        userId,
        getVoiceChannelById,
        isGuildMember,
      });
      if (!accessResult.ok) {
        callback({ ok: false, error: accessResult.error });
        return;
      }
      if (!hasAvailableVoiceWorkers(msManager)) {
        callback({ ok: false, error: VOICE_SERVICE_UNAVAILABLE_ERROR });
        return;
      }

      const existingChannelId = voiceRuntime.getUserActiveVoiceChannelId(userId);
      await voiceRuntime.cleanupUserVoiceSessions(io, socket, userId, existingChannelId);

      const room = await msManager.getOrCreateRoom(channelId);
      const rtpCapabilities = room.router.rtpCapabilities;
      const participants = voiceRuntime.markUserJoinedChannel(io, socket, channelId, userId);
      const existingProducers = listExistingRoomProducers({
        msManager,
        channelId,
        skipUserId: userId,
      });

      callback({
        ok: true,
        rtpCapabilities,
        existingProducers,
        participants,
      });
      runtimeMetrics.recordVoiceEvent('voice:join_ready', {
        userId,
        channelId,
        existingProducerCount: existingProducers.length,
        participantCount: participants.length,
      });
      runtimeMetrics.recordVoiceJoin({ channelId, userId });
    } catch (err) {
      console.error('voice:join error:', err);
      runtimeMetrics.recordVoiceError('voice:join', { userId, message: err.message });
      callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Failed to join voice channel') });
    }
  };
}

module.exports = {
  createVoiceJoinHandler,
};
