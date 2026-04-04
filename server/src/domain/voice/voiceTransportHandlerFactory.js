const {
  createVoiceTransportConnectionHandlers,
} = require('./voiceTransportConnectionHandlers');
const {
  createVoiceJoinHandler,
} = require('./voiceTransportJoinHandler');
const {
  createVoiceTransportMediaHandlers: createMediaHandlers,
} = require('./voiceTransportMediaHandlers');

function createVoiceTransportFlow({
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
  validateVoiceCreateTransportPayload,
  validateVoiceConnectTransportPayload,
  validateVoiceProducePayload,
  validateVoiceConsumePayload,
  validateVoiceResumeConsumerPayload,
} = {}) {
  const verifyVoiceSession = (channelId, callback) => {
    if (!voiceRuntime.hasLiveVoiceSession(channelId, userId)) {
      callback({ ok: false, error: 'Not in this voice channel' });
      return false;
    }
    return true;
  };

  return {
    handleJoin: createVoiceJoinHandler({
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
    }),
    ...createVoiceTransportConnectionHandlers({
      userId,
      msManager,
      runtimeMetrics,
      rejectInvalidVoicePayload,
      validateVoiceCreateTransportPayload,
      validateVoiceConnectTransportPayload,
      verifyVoiceSession,
    }),
    ...createMediaHandlers({
      io,
      socket,
      userId,
      msManager,
      runtimeMetrics,
      rejectInvalidVoicePayload,
      validateVoiceProducePayload,
      validateVoiceConsumePayload,
      validateVoiceResumeConsumerPayload,
      verifyVoiceSession,
    }),
  };
}

module.exports = {
  createVoiceTransportFlow,
};
