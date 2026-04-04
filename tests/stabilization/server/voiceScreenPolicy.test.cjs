const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCREEN_VIDEO_LAYER_TARGET_BITRATES,
  applyScreenVideoConsumerPolicy,
  isScreenVideo,
  normalizeBitrateBps,
  normalizeConsumerQuality,
  requestConsumerKeyFrame,
} = require('../../../server/src/domain/voice/voiceScreenPolicy');

test('voice screen policy normalizes bitrate and quality metrics', () => {
  const originalNow = Date.now;
  Date.now = () => 1234567890;
  try {
    assert.equal(normalizeBitrateBps(1500), 1_500_000);
    assert.equal(normalizeBitrateBps(250_000), 250_000);
    assert.equal(normalizeBitrateBps('nope'), null);

    assert.deepEqual(
      normalizeConsumerQuality({
        availableIncomingBitrate: 1500,
        framesPerSecond: 30,
        jitterBufferDelayMs: 100,
        freezeCount: 0,
        pauseCount: 1,
      }),
      {
        availableIncomingBitrate: 1_500_000,
        framesPerSecond: 30,
        jitterBufferDelayMs: 100,
        freezeCount: 0,
        pauseCount: 1,
        updatedAtMs: 1234567890,
      }
    );
  } finally {
    Date.now = originalNow;
  }

  assert.equal(isScreenVideo('video', 'screen-video'), true);
  assert.equal(isScreenVideo('audio', 'screen-video'), false);
});

test('voice screen policy debounces key-frame requests and adjusts preferred layers', async () => {
  const originalNow = Date.now;
  let nowMs = 1_000;
  Date.now = () => nowMs;

  const requestedKeyFrames = [];
  const preferredLayers = [];
  const consumer = {
    closed: false,
    type: 'simulcast',
    currentLayers: { spatialLayer: 2 },
    score: { score: 10 },
    async requestKeyFrame() {
      requestedKeyFrames.push(Date.now());
    },
    async setPreferredLayers(payload) {
      preferredLayers.push(payload);
    },
  };
  const state = {
    source: 'screen-video',
    preferredSpatialLayer: 2,
    badSamples: 0,
    goodSamples: 0,
    lastFreezeCount: 0,
    quality: {
      availableIncomingBitrate: 500_000,
      framesPerSecond: 20,
      jitterBufferDelayMs: 500,
      freezeCount: 1,
    },
  };

  try {
    assert.equal(await requestConsumerKeyFrame(consumer, state, 'initial'), true);
    assert.equal(await requestConsumerKeyFrame(consumer, state, 'debounced'), false);

    nowMs += 3_000;
    assert.equal(await applyScreenVideoConsumerPolicy(consumer, state), false);
    assert.equal(await applyScreenVideoConsumerPolicy(consumer, state), true);
    assert.deepEqual(preferredLayers.pop(), { spatialLayer: 1, temporalLayer: 2 });

    state.quality = {
      availableIncomingBitrate: SCREEN_VIDEO_LAYER_TARGET_BITRATES[2] * 2,
      framesPerSecond: 30,
      jitterBufferDelayMs: 100,
      freezeCount: 1,
    };
    state.preferredSpatialLayer = 1;
    state.badSamples = 0;
    state.goodSamples = 0;
    consumer.currentLayers = { spatialLayer: 1 };

    await applyScreenVideoConsumerPolicy(consumer, state);
    await applyScreenVideoConsumerPolicy(consumer, state);
    await applyScreenVideoConsumerPolicy(consumer, state);
    const raised = await applyScreenVideoConsumerPolicy(consumer, state);

    assert.equal(raised, true);
    assert.deepEqual(preferredLayers.pop(), { spatialLayer: 2, temporalLayer: 2 });
  } finally {
    Date.now = originalNow;
  }
});
