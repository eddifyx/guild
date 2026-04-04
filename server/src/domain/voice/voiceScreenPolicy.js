const SCREEN_VIDEO_KEY_FRAME_REQUEST_DELAY = 500;
const SCREEN_VIDEO_KEY_FRAME_REQUEST_DEBOUNCE_MS = 2_000;
const SCREEN_VIDEO_LAYER_TARGET_BITRATES = [1_200_000, 2_500_000, 6_000_000];

function isScreenVideo(kind, source) {
  return kind === 'video' && source === 'screen-video';
}

function isLayeredConsumer(consumer) {
  return consumer?.type === 'simulcast' || consumer?.type === 'svc';
}

function normalizeMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBitrateBps(value) {
  const normalizedValue = normalizeMetric(value);
  if (normalizedValue === null) return null;

  if (normalizedValue > 0 && normalizedValue < 100_000) {
    return normalizedValue * 1000;
  }

  return normalizedValue;
}

function normalizeConsumerQuality(payload = {}) {
  return {
    availableIncomingBitrate: normalizeBitrateBps(payload.availableIncomingBitrate),
    framesPerSecond: normalizeMetric(payload.framesPerSecond),
    jitterBufferDelayMs: normalizeMetric(payload.jitterBufferDelayMs),
    freezeCount: normalizeMetric(payload.freezeCount),
    pauseCount: normalizeMetric(payload.pauseCount),
    updatedAtMs: Date.now(),
  };
}

async function requestConsumerKeyFrame(consumer, state, reason = 'unspecified') {
  if (!consumer || consumer.closed || typeof consumer.requestKeyFrame !== 'function') {
    return false;
  }

  const nowMs = Date.now();
  if (
    typeof state?.lastKeyFrameRequestAtMs === 'number'
    && nowMs - state.lastKeyFrameRequestAtMs < SCREEN_VIDEO_KEY_FRAME_REQUEST_DEBOUNCE_MS
  ) {
    return false;
  }

  if (state) {
    state.lastKeyFrameRequestAtMs = nowMs;
  }

  try {
    await consumer.requestKeyFrame();
    return true;
  } catch (err) {
    console.warn(`[mediasoup] Failed to request key frame for ${reason}:`, err?.message || err);
    return false;
  }
}

async function setConsumerPreferredSpatialLayer(consumer, state, spatialLayer) {
  if (
    !consumer
    || consumer.closed
    || !isLayeredConsumer(consumer)
    || typeof consumer.setPreferredLayers !== 'function'
  ) {
    return false;
  }

  const boundedSpatialLayer = Math.max(
    0,
    Math.min(spatialLayer, SCREEN_VIDEO_LAYER_TARGET_BITRATES.length - 1)
  );

  if (state?.preferredSpatialLayer === boundedSpatialLayer) {
    return false;
  }

  try {
    await consumer.setPreferredLayers({
      spatialLayer: boundedSpatialLayer,
      temporalLayer: 2,
    });
    if (state) {
      state.preferredSpatialLayer = boundedSpatialLayer;
      state.lastPolicyAppliedAtMs = Date.now();
    }
    return true;
  } catch (err) {
    console.warn('[mediasoup] Failed to set preferred layers:', err?.message || err);
    return false;
  }
}

async function applyScreenVideoConsumerPolicy(consumer, state) {
  if (!consumer || consumer.closed || state?.source !== 'screen-video' || !isLayeredConsumer(consumer)) {
    return false;
  }

  if (!state.quality) {
    if (!Number.isInteger(state.preferredSpatialLayer)) {
      return setConsumerPreferredSpatialLayer(
        consumer,
        state,
        SCREEN_VIDEO_LAYER_TARGET_BITRATES.length - 1
      );
    }
    return false;
  }

  const currentPreferredSpatialLayer = Number.isInteger(state.preferredSpatialLayer)
    ? state.preferredSpatialLayer
    : (
      Number.isInteger(consumer.currentLayers?.spatialLayer)
        ? consumer.currentLayers.spatialLayer
        : SCREEN_VIDEO_LAYER_TARGET_BITRATES.length - 1
    );

  const scoreValue = normalizeMetric(consumer.score?.score);
  const { availableIncomingBitrate, framesPerSecond, jitterBufferDelayMs, freezeCount } = state.quality;
  const freezeCountIncreased = (
    typeof freezeCount === 'number'
    && typeof state.lastFreezeCount === 'number'
    && freezeCount > state.lastFreezeCount
  );

  const isBadSample = (
    (typeof scoreValue === 'number' && scoreValue < 7)
    || (typeof jitterBufferDelayMs === 'number' && jitterBufferDelayMs > 400)
    || (typeof framesPerSecond === 'number' && framesPerSecond < 24)
    || freezeCountIncreased
  );

  const nextHigherSpatialLayer = currentPreferredSpatialLayer + 1;
  const nextLayerTargetBitrate = SCREEN_VIDEO_LAYER_TARGET_BITRATES[nextHigherSpatialLayer] || null;
  const isHealthySample = (
    typeof scoreValue === 'number'
    && scoreValue === 10
    && typeof jitterBufferDelayMs === 'number'
    && jitterBufferDelayMs < 150
    && typeof framesPerSecond === 'number'
    && framesPerSecond >= 28
    && typeof nextLayerTargetBitrate === 'number'
    && typeof availableIncomingBitrate === 'number'
    && availableIncomingBitrate >= nextLayerTargetBitrate * 1.25
  );

  if (isBadSample) {
    state.badSamples += 1;
    state.goodSamples = 0;
  } else if (isHealthySample) {
    state.goodSamples += 1;
    state.badSamples = 0;
  } else {
    state.badSamples = 0;
    state.goodSamples = 0;
  }

  if (typeof freezeCount === 'number') {
    state.lastFreezeCount = freezeCount;
  }

  if (state.badSamples >= 2 && currentPreferredSpatialLayer > 0) {
    state.badSamples = 0;
    state.goodSamples = 0;
    return setConsumerPreferredSpatialLayer(consumer, state, currentPreferredSpatialLayer - 1);
  }

  if (
    state.goodSamples >= 4
    && currentPreferredSpatialLayer < SCREEN_VIDEO_LAYER_TARGET_BITRATES.length - 1
  ) {
    state.badSamples = 0;
    state.goodSamples = 0;
    return setConsumerPreferredSpatialLayer(consumer, state, currentPreferredSpatialLayer + 1);
  }

  return false;
}

module.exports = {
  SCREEN_VIDEO_KEY_FRAME_REQUEST_DELAY,
  SCREEN_VIDEO_KEY_FRAME_REQUEST_DEBOUNCE_MS,
  SCREEN_VIDEO_LAYER_TARGET_BITRATES,
  applyScreenVideoConsumerPolicy,
  isLayeredConsumer,
  isScreenVideo,
  normalizeBitrateBps,
  normalizeConsumerQuality,
  normalizeMetric,
  requestConsumerKeyFrame,
  setConsumerPreferredSpatialLayer,
};
