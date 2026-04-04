const {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  attachProducerCloseBroadcast,
  buildProducerPayload,
  getVoiceSocketError,
  hasAvailableVoiceWorkers,
  listExistingRoomProducers,
  verifyVoiceChannelAccess,
} = require('./voiceTransportSupport');
const { createVoiceTransportFlow } = require('./voiceTransportHandlerFactory');

module.exports = {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  attachProducerCloseBroadcast,
  buildProducerPayload,
  createVoiceTransportFlow,
  getVoiceSocketError,
  hasAvailableVoiceWorkers,
  listExistingRoomProducers,
  verifyVoiceChannelAccess,
};
