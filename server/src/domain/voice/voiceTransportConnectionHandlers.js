const { getVoiceSocketError } = require('./voiceTransportSupport');

function createVoiceTransportConnectionHandlers({
  userId,
  msManager,
  runtimeMetrics,
  rejectInvalidVoicePayload,
  validateVoiceCreateTransportPayload,
  validateVoiceConnectTransportPayload,
  verifyVoiceSession,
} = {}) {
  return {
    async handleCreateTransport(payload, callback) {
      if (typeof callback !== 'function') return;
      const transportPayload = validateVoiceCreateTransportPayload(payload);
      if (!transportPayload.ok) {
        rejectInvalidVoicePayload('voice:create-transport', transportPayload, callback);
        return;
      }
      const { channelId, direction, purpose } = transportPayload.value;
      try {
        if (!verifyVoiceSession(channelId, callback)) return;
        const transportOptions = await msManager.createWebRtcTransport(channelId, userId, direction, purpose);
        runtimeMetrics.recordVoiceEvent('voice:transport_created', {
          userId,
          channelId,
          direction,
          purpose: purpose || null,
          transportId: transportOptions?.id || null,
        });
        callback({ ok: true, transportOptions });
      } catch (err) {
        console.error('voice:create-transport error:', err);
        callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Transport creation failed') });
      }
    },

    async handleConnectTransport(payload, callback) {
      if (typeof callback !== 'function') return;
      const connectPayload = validateVoiceConnectTransportPayload(payload);
      if (!connectPayload.ok) {
        rejectInvalidVoicePayload('voice:connect-transport', connectPayload, callback);
        return;
      }
      const { channelId, transportId, dtlsParameters } = connectPayload.value;
      try {
        if (!verifyVoiceSession(channelId, callback)) return;
        await msManager.connectTransport(channelId, userId, transportId, dtlsParameters);
        runtimeMetrics.recordVoiceEvent('voice:transport_connected', {
          userId,
          channelId,
          transportId,
        });
        callback({ ok: true });
      } catch (err) {
        console.error('voice:connect-transport error:', err);
        callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Transport connection failed') });
      }
    },
  };
}

module.exports = {
  createVoiceTransportConnectionHandlers,
};
