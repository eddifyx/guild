const {
  addVoiceSession,
  clearChannelVoiceSessions,
  removeUserFromAllVoiceChannels,
  getUserVoiceSession,
  getUserById,
  updateVoiceMuteState,
  getVoiceChannelById,
  isGuildMember,
  getGuildMembers,
} = require('../db');

const msManager = require('../voice/mediasoupManager');
const runtimeMetrics = require('../monitoring/runtimeMetrics');
const { createVoicePresenceFlow } = require('../domain/voice/voicePresenceFlow');
const { createVoiceSessionRuntime } = require('../domain/voice/voiceSessionRuntime');
const {
  createVoiceTransportFlow,
  getVoiceSocketError,
} = require('../domain/voice/voiceTransportFlow');
const {
  validateVoiceConnectTransportPayload,
  validateVoiceConsumePayload,
  validateVoiceConsumerQualityPayload,
  validateVoiceCreateTransportPayload,
  validateVoiceJoinPayload,
  validateVoiceLeavePayload,
  validateVoiceProducePayload,
  validateVoiceResumeConsumerPayload,
  validateVoiceScreenShareStatePayload,
  validateVoiceSpeakingPayload,
  validateVoiceToggleDeafenPayload,
  validateVoiceToggleMutePayload,
} = require('./validators/voicePayloads');
const voiceRuntime = createVoiceSessionRuntime({
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
});

function destroyLiveVoiceChannel(io, channelId, reason = 'channel-destroyed') {
  voiceRuntime.destroyLiveVoiceChannel(io, channelId, reason);
}

function handleVoice(io, socket) {
  const { userId } = socket.handshake.auth;

  function rejectInvalidVoicePayload(eventName, validation, callback = null) {
    runtimeMetrics.recordVoiceEvent('voice:invalid_payload', {
      userId,
      event: eventName,
      channelId: validation?.value?.channelId || null,
      code: validation?.code || null,
      reason: validation?.error || 'Invalid payload',
    });
    if (typeof callback === 'function') {
      callback({
        ok: false,
        error: validation?.error || 'Invalid payload',
        code: validation?.code || null,
      });
    }
  }

  const voicePresenceFlow = createVoicePresenceFlow({
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
  });

  const voiceTransportFlow = createVoiceTransportFlow({
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
  });

  socket.on('voice:join', voiceTransportFlow.handleJoin);
  socket.on('voice:create-transport', voiceTransportFlow.handleCreateTransport);
  socket.on('voice:connect-transport', voiceTransportFlow.handleConnectTransport);
  socket.on('voice:produce', voiceTransportFlow.handleProduce);
  socket.on('voice:consume', voiceTransportFlow.handleConsume);
  socket.on('voice:resume-consumer', voiceTransportFlow.handleResumeConsumer);

  socket.on('voice:consumer-quality', voicePresenceFlow.handleConsumerQuality);
  socket.on('voice:toggle-mute', voicePresenceFlow.handleToggleMute);
  socket.on('voice:toggle-deafen', voicePresenceFlow.handleToggleDeafen);
  socket.on('voice:speaking', voicePresenceFlow.handleSpeaking);
  socket.on('voice:screen-share-state', voicePresenceFlow.handleScreenShareState);
  socket.on('voice:leave', voicePresenceFlow.handleLeave);
  socket.on('disconnect', voicePresenceFlow.handleDisconnect);
}

module.exports = {
  handleVoice,
  getLiveChannelParticipants: (channelId) => voiceRuntime.getLiveChannelParticipants(channelId),
  destroyLiveVoiceChannel,
};
