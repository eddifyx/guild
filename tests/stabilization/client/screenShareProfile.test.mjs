import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPreferredScreenShareConstraints,
  areExperimentalScreenCodecsEnabled,
  getExperimentalScreenVideoBypassMode,
  getPreferredScreenShareCodecCandidates,
  getPrimaryCodecMimeTypeFromRtpParameters,
  getRuntimeScreenShareCodecMode,
  getScreenShareRequestedCapture,
  getSimulcastScreenShareEncodings,
  getSingleScreenShareEncoding,
  SCREEN_SHARE_PROFILES,
  summarizeReceiverVideoCodecSupport,
  summarizeScreenShareHardware,
  summarizeScreenShareProfile,
  summarizeSelectedCodec,
} from '../../../client/src/features/voice/screenShareProfile.mjs';

function createMemoryStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('screen share profile helpers summarize profiles and requested capture consistently', () => {
  assert.deepEqual(
    summarizeScreenShareProfile(SCREEN_SHARE_PROFILES[1]),
    {
      id: 'balanced-720p30',
      label: '720p30',
      targetResolution: '1280x720',
      targetFps: 30,
      maxBitrate: 3_000_000,
      startBitrateKbps: 2000,
      minBitrateKbps: 1000,
    }
  );
  assert.deepEqual(
    getScreenShareRequestedCapture(SCREEN_SHARE_PROFILES[1]),
    {
      idealResolution: '1280x720',
      minimumResolution: '1280x720',
      targetFps: 30,
      captureFpsCeiling: 30,
      maxBitrate: 3_000_000,
      startBitrateKbps: 2000,
      minBitrateKbps: 1000,
    }
  );
});

test('screen share codec helpers rank preferred codecs and compute bypass modes', () => {
  const candidates = getPreferredScreenShareCodecCandidates({
    sendRtpCapabilities: {
      codecs: [
        { mimeType: 'video/vp8' },
        { mimeType: 'video/h264', parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f' } },
        { mimeType: 'video/av1' },
      ],
    },
  }, { preference: 'h264' });

  assert.deepEqual(candidates.map((codec) => codec.mimeType), [
    'video/h264',
    'video/vp8',
    'video/av1',
  ]);
  assert.equal(
    getExperimentalScreenVideoBypassMode({
      source: 'screen-video',
      codecMimeType: 'video/h264',
      experimentsEnabled: true,
    }),
    'bypassed-staging-h264'
  );
  assert.equal(
    getPrimaryCodecMimeTypeFromRtpParameters({
      codecs: [{ mimeType: 'video/rtx' }, { mimeType: 'video/VP8' }],
    }),
    'video/VP8'
  );
  assert.deepEqual(
    summarizeSelectedCodec({ mimeType: 'video/VP8', preferredPayloadType: 96, clockRate: 90000, parameters: {} }),
    { mimeType: 'video/VP8', preferredPayloadType: 96, clockRate: 90000, parameters: {} }
  );
});

test('screen share runtime codec mode honors experiment gates and staging windows fallback', () => {
  const storage = createMemoryStorage({
    'guild:screenShareCodecMode': 'h264',
  });

  assert.equal(
    getRuntimeScreenShareCodecMode({
      storage,
      getAppFlavor: () => 'staging',
      getPlatform: () => 'win32',
      experimentsEnabled: true,
    }),
    'vp8'
  );
  assert.equal(storage.getItem('guild:screenShareCodecMode'), null);

  storage.setItem('guild:screenShareCodecMode', 'av1');
  assert.equal(
    getRuntimeScreenShareCodecMode({
      storage,
      getAppFlavor: () => 'staging',
      getPlatform: () => 'darwin',
      experimentsEnabled: true,
    }),
    'av1'
  );
  assert.equal(
    areExperimentalScreenCodecsEnabled({
      isDev: false,
      getAppFlavor: () => 'production',
    }),
    false
  );
});

test('screen share encoding helpers derive single and simulcast encodings safely', () => {
  const singleEncoding = getSingleScreenShareEncoding({
    getSettings: () => ({ width: 2560, height: 1440 }),
  }, SCREEN_SHARE_PROFILES[1]);

  assert.equal(singleEncoding.scaleResolutionDownBy, 2);
  assert.equal(getSimulcastScreenShareEncodings().length, 3);
});

test('screen share helpers summarize hardware and receiver codec support using injected capability sources', () => {
  assert.deepEqual(
    summarizeScreenShareHardware({
      navigatorObject: { hardwareConcurrency: 8, deviceMemory: 8 },
      getPlatform: () => 'darwin',
      isHardwareAccelerationEnabled: () => true,
      getGPUFeatureStatus: () => ({ gpuCompositing: 'enabled', videoDecode: 'enabled', videoEncode: 'enabled' }),
    }),
    {
      platform: 'darwin',
      cpuThreads: 8,
      deviceMemoryGb: 8,
      hardwareAccelerationEnabled: true,
      gpuCompositing: 'enabled',
      gpuRasterization: null,
      videoDecode: 'enabled',
      videoEncode: 'enabled',
      lowResourceHint: true,
    }
  );

  assert.deepEqual(
    summarizeReceiverVideoCodecSupport(() => [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }]),
    { av1: false, h264: true, vp8: true, vp9: false }
  );
});

test('screen share constraint application falls back through alternate profiles', async () => {
  const attempts = [];
  const track = {
    async applyConstraints(constraints) {
      attempts.push(constraints);
      if (attempts.length === 1) {
        throw new Error('too large');
      }
    },
  };

  await applyPreferredScreenShareConstraints(track, SCREEN_SHARE_PROFILES[0]);

  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0].width, { ideal: 1920, max: 1920 });
  assert.deepEqual(attempts[1].width, { ideal: 1280, max: 1280 });
});
