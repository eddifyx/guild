const {
  attachProducerCloseBroadcast,
  buildProducerPayload,
  getVoiceSocketError,
} = require('./voiceTransportSupport');

function createVoiceTransportMediaHandlers({
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
} = {}) {
  return {
    async handleProduce(payload, callback) {
      if (typeof callback !== 'function') return;
      const producePayload = validateVoiceProducePayload(payload);
      if (!producePayload.ok) {
        rejectInvalidVoicePayload('voice:produce', producePayload, callback);
        return;
      }

      const {
        channelId,
        transportId,
        kind,
        rtpParameters,
        appData,
      } = producePayload.value;

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

        attachProducerCloseBroadcast({
          io,
          channelId,
          producerMeta: {
            ...producerMeta,
            producerUserId: userId,
          },
        });

        const producerPayload = buildProducerPayload({
          ...producerMeta,
          producerUserId: userId,
        });

        socket.to(`voice:${channelId}`).emit('voice:new-producer', producerPayload);
        runtimeMetrics.recordVoiceEvent('voice:producer_ready', {
          userId,
          channelId,
          producerId: producerMeta.producerId,
          kind,
          source: producerMeta.source,
        });
        runtimeMetrics.recordVoiceProduce({ channelId, userId, kind, source: producerMeta.source });
        callback({ ok: true, producerId: producerMeta.producerId, source: producerMeta.source });
      } catch (err) {
        console.error('voice:produce error:', err);
        runtimeMetrics.recordVoiceError('voice:produce', { userId, channelId, message: err.message });
        callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Produce failed') });
      }
    },

    async handleConsume(payload, callback) {
      if (typeof callback !== 'function') return;
      const consumePayload = validateVoiceConsumePayload(payload);
      if (!consumePayload.ok) {
        rejectInvalidVoicePayload('voice:consume', consumePayload, callback);
        return;
      }
      const { channelId, producerId, producerUserId, rtpCapabilities } = consumePayload.value;
      try {
        if (!verifyVoiceSession(channelId, callback)) return;
        const consumerData = await msManager.consume(channelId, userId, producerUserId, producerId, rtpCapabilities);
        runtimeMetrics.recordVoiceEvent('voice:consumer_ready', {
          userId,
          channelId,
          producerId,
          producerUserId,
          kind: consumerData?.kind || null,
          paused: consumerData?.paused === true,
        });
        runtimeMetrics.recordVoiceConsume({ channelId, userId, producerUserId, producerId });
        callback({ ok: true, ...consumerData });
      } catch (err) {
        console.error('voice:consume error:', err);
        runtimeMetrics.recordVoiceError('voice:consume', { userId, channelId, message: err.message });
        callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Consume failed') });
      }
    },

    async handleResumeConsumer(payload, callback) {
      if (typeof callback !== 'function') return;
      const resumePayload = validateVoiceResumeConsumerPayload(payload);
      if (!resumePayload.ok) {
        rejectInvalidVoicePayload('voice:resume-consumer', resumePayload, callback);
        return;
      }
      const { channelId, producerId } = resumePayload.value;
      try {
        if (!verifyVoiceSession(channelId, callback)) return;
        await msManager.resumeConsumer(channelId, userId, producerId);
        callback({ ok: true });
      } catch (err) {
        console.error('voice:resume-consumer error:', err);
        runtimeMetrics.recordVoiceError('voice:resume-consumer', { userId, channelId, message: err.message });
        callback({ ok: false, error: getVoiceSocketError(msManager, err, 'Resume consumer failed') });
      }
    },
  };
}

module.exports = {
  createVoiceTransportMediaHandlers,
};
