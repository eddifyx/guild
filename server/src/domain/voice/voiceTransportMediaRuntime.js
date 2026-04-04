const {
  applyScreenVideoConsumerPolicy,
  isScreenVideo,
  normalizeConsumerQuality,
  requestConsumerKeyFrame,
  SCREEN_VIDEO_KEY_FRAME_REQUEST_DELAY,
} = require('./voiceScreenPolicy');
const {
  getSendTransportById,
} = require('./voiceTransportState');

function buildConsumerState(consumer, source) {
  return {
    source,
    lastKeyFrameRequestAtMs: 0,
    currentSpatialLayer: Number.isInteger(consumer.currentLayers?.spatialLayer)
      ? consumer.currentLayers.spatialLayer
      : null,
    preferredSpatialLayer: Number.isInteger(consumer.preferredLayers?.spatialLayer)
      ? consumer.preferredLayers.spatialLayer
      : null,
    badSamples: 0,
    goodSamples: 0,
    lastFreezeCount: null,
    quality: null,
    lastPolicyAppliedAtMs: null,
  };
}

function createVoiceTransportMediaRuntime({
  rooms = new Map(),
} = {}) {
  function getRoom(channelId) {
    return rooms.get(channelId) || null;
  }

  function getPeer(room, userId) {
    return room?.peers?.get(userId) || null;
  }

  async function produce(channelId, userId, transportId, kind, rtpParameters, appData = {}) {
    const room = getRoom(channelId);
    if (!room) throw new Error('Room not found');

    const peer = getPeer(room, userId);
    const sendTransport = getSendTransportById(peer, transportId);
    if (!peer || !sendTransport) throw new Error('Send transport not found');

    const source = appData?.source || kind;

    for (const meta of peer.producers.values()) {
      if (meta.source !== source) continue;
      try { meta.producer.close(); } catch {}
    }

    const producer = await sendTransport.produce({
      kind,
      rtpParameters,
      appData: { source },
      ...(isScreenVideo(kind, source) ? { keyFrameRequestDelay: SCREEN_VIDEO_KEY_FRAME_REQUEST_DELAY } : {}),
    });

    const removeProducer = () => {
      if (!peer.producers.has(producer.id)) return;
      peer.producers.delete(producer.id);
    };

    producer.on('transportclose', () => {
      removeProducer();
      try { producer.close(); } catch {}
    });
    if (producer.observer?.on) {
      producer.observer.on('close', removeProducer);
    }

    peer.producers.set(producer.id, {
      producer,
      kind,
      source,
    });

    return {
      producerId: producer.id,
      kind,
      source,
      producer,
    };
  }

  async function consume(channelId, consumerUserId, producerUserId, producerId, rtpCapabilities) {
    const room = getRoom(channelId);
    if (!room) throw new Error('Room not found');

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const consumerPeer = getPeer(room, consumerUserId);
    if (!consumerPeer || !consumerPeer.recvTransport) {
      throw new Error('Recv transport not found');
    }

    const producerPeer = getPeer(room, producerUserId);
    const producerMeta = producerPeer?.producers?.get(producerId) || null;
    const source = producerMeta?.source || null;
    const startPaused = isScreenVideo(producerMeta?.kind || null, source);

    const consumer = await consumerPeer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: startPaused,
    });

    consumer.on('transportclose', () => consumer.close());
    consumer.on('producerclose', () => {
      consumer.close();
      consumerPeer.consumers.delete(producerId);
      consumerPeer.consumerState.delete(producerId);
    });

    consumerPeer.consumers.set(producerId, consumer);

    const consumerState = buildConsumerState(consumer, source);
    consumerPeer.consumerState.set(producerId, consumerState);

    if (isScreenVideo(consumer.kind, source)) {
      consumer.on('layerschange', (layers) => {
        const previousSpatialLayer = Number.isInteger(consumerState?.currentSpatialLayer)
          ? consumerState.currentSpatialLayer
          : null;
        const nextSpatialLayer = Number.isInteger(layers?.spatialLayer)
          ? layers.spatialLayer
          : null;
        if (consumerState) {
          consumerState.currentSpatialLayer = nextSpatialLayer;
        }

        const gainedSpatialLayer = previousSpatialLayer === null && nextSpatialLayer !== null;
        const spatialUpshift = (
          previousSpatialLayer !== null
          && nextSpatialLayer !== null
          && nextSpatialLayer > previousSpatialLayer
        );

        if (gainedSpatialLayer || spatialUpshift) {
          void requestConsumerKeyFrame(consumer, consumerState, 'screen-video-layerschange');
        }
      });

      void applyScreenVideoConsumerPolicy(consumer, consumerState);
    }

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      paused: startPaused,
    };
  }

  async function resumeConsumer(channelId, consumerUserId, producerId) {
    const room = getRoom(channelId);
    if (!room) throw new Error('Room not found');

    const consumerPeer = getPeer(room, consumerUserId);
    if (!consumerPeer) {
      throw new Error('Peer not found');
    }

    const consumer = consumerPeer.consumers.get(producerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    await consumer.resume();

    if (consumer.kind === 'video') {
      const consumerState = consumerPeer.consumerState.get(producerId) || null;
      await requestConsumerKeyFrame(consumer, consumerState, 'resumed-consumer');
    }

    return consumer;
  }

  async function updateConsumerQuality(channelId, consumerUserId, producerId, payload = {}) {
    const room = getRoom(channelId);
    if (!room) return false;

    const consumerPeer = getPeer(room, consumerUserId);
    if (!consumerPeer) return false;

    const consumer = consumerPeer.consumers.get(producerId);
    const consumerState = consumerPeer.consumerState.get(producerId);
    if (!consumer || !consumerState || consumerState.source !== 'screen-video') {
      return false;
    }

    consumerState.quality = normalizeConsumerQuality(payload);
    await applyScreenVideoConsumerPolicy(consumer, consumerState);
    return true;
  }

  return {
    consume,
    produce,
    resumeConsumer,
    updateConsumerQuality,
  };
}

module.exports = {
  buildConsumerState,
  createVoiceTransportMediaRuntime,
};
