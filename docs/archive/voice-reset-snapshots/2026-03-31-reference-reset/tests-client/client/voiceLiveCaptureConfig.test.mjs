import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRnnoiseFallbackSuppressionRuntime,
  buildVoiceLiveCaptureConfig,
  resolveVoiceSuppressionRuntime,
  shouldUseDirectMicLane,
} from '../../../client/src/features/voice/voiceLiveCaptureConfig.mjs';

test('voice live capture config keeps mac standard capture on the browser/WebRTC lane while preserving system Mic Mode control', () => {
  const config = buildVoiceLiveCaptureConfig({
    mode: 'balanced',
    voiceSafeMode: false,
    appleVoiceAvailable: true,
    readStoredVoiceInputDeviceIdFn: () => '',
    prefersAppleSystemVoiceIsolationFn: () => true,
    getNoiseSuppressionRuntimeStateFn: ({ preferAppleVoiceProcessing, noiseSuppressionBackend }) => ({
      backend: preferAppleVoiceProcessing ? 'apple' : (noiseSuppressionBackend || 'rnnoise'),
      requiresWarmup: true,
      fallbackReason: null,
    }),
    buildVoiceCaptureConstraintsFn: ({ mode, deviceId, noiseSuppressionEnabled }) => ({
      audio: { mode, deviceId: deviceId || null, noiseSuppressionEnabled },
    }),
    isUltraLowLatencyModeFn: (mode) => mode === 'ultra',
    ultraLowLatencyMode: 'ultra',
    webrtcApmBackend: 'webrtc-apm',
  });

  assert.deepEqual(config, {
    activeVoiceProcessingMode: 'balanced',
    captureConstraintMode: 'balanced',
    useRawMicPath: false,
    noiseSuppressionEnabled: true,
    inputId: '',
    requestedInputId: '',
    preferSystemMicMode: true,
    preferAppleVoiceProcessing: false,
    requestedSuppressionRuntime: {
      backend: 'webrtc-apm',
      requiresWarmup: true,
      fallbackReason: null,
    },
    initialConstraints: {
      audio: {
        mode: 'balanced',
        deviceId: null,
        noiseSuppressionEnabled: true,
      },
    },
    fallbackConstraints: {
      audio: {
        mode: 'balanced',
        deviceId: null,
        noiseSuppressionEnabled: true,
      },
    },
  });
});

test('voice live capture config resolves suppression runtime and RNNoise fallback consistently', () => {
  const requestedSuppressionRuntime = {
    backend: 'apple',
    requiresWarmup: true,
    fallbackReason: 'old',
  };

  const preferredRuntime = resolveVoiceSuppressionRuntime({
    preferAppleVoiceProcessing: true,
    requestedSuppressionRuntime,
    resolveNoiseSuppressionRuntimeStateFn: () => ({ backend: 'rnnoise' }),
  });
  assert.deepEqual(preferredRuntime, {
    backend: 'apple',
    requiresWarmup: true,
    requestedBackend: 'apple',
    fallbackReason: null,
  });

  const fallbackRuntime = buildRnnoiseFallbackSuppressionRuntime({
    activeVoiceProcessingMode: 'balanced',
    noiseSuppressionEnabled: true,
    requestedSuppressionRuntime,
    fallbackReason: 'Apple unavailable',
    getNoiseSuppressionRuntimeStateFn: () => ({
      backend: 'rnnoise',
      requiresWarmup: false,
    }),
    rnnoiseBackend: 'rnnoise',
  });
  assert.deepEqual(fallbackRuntime, {
    backend: 'rnnoise',
    requiresWarmup: false,
    requestedBackend: 'apple',
    fallbackReason: 'Apple unavailable',
  });
});

test('voice live capture config normalizes a stored default device id to the implicit default capture lane', () => {
  const config = buildVoiceLiveCaptureConfig({
    mode: 'balanced',
    voiceSafeMode: false,
    appleVoiceAvailable: true,
    readStoredVoiceInputDeviceIdFn: () => 'default',
    prefersAppleSystemVoiceIsolationFn: () => true,
    getNoiseSuppressionRuntimeStateFn: ({ noiseSuppressionBackend }) => ({
      backend: noiseSuppressionBackend || 'rnnoise',
      requiresWarmup: true,
      fallbackReason: null,
    }),
    buildVoiceCaptureConstraintsFn: ({ deviceId }) => ({
      audio: { deviceId: deviceId || null },
    }),
    isUltraLowLatencyModeFn: () => false,
    ultraLowLatencyMode: 'ultra',
    webrtcApmBackend: 'webrtc-apm',
  });

  assert.equal(config.inputId, '');
  assert.equal(config.requestedInputId, '');
  assert.equal(config.preferSystemMicMode, true);
  assert.deepEqual(config.initialConstraints, { audio: { deviceId: null } });
});

test('voice live capture config detects when the direct mic lane should be used', () => {
  assert.equal(shouldUseDirectMicLane({
    useRawMicPath: true,
    suppressionRuntimeBackend: 'rnnoise',
    noiseSuppressionEnabled: true,
    webrtcApmBackend: 'webrtc-apm',
  }), true);
  assert.equal(shouldUseDirectMicLane({
    useRawMicPath: false,
    suppressionRuntimeBackend: 'apple-voice-processing',
    noiseSuppressionEnabled: true,
    webrtcApmBackend: 'webrtc-apm',
  }), false);
  assert.equal(shouldUseDirectMicLane({
    useRawMicPath: false,
    suppressionRuntimeBackend: 'webrtc-apm',
    noiseSuppressionEnabled: true,
    webrtcApmBackend: 'webrtc-apm',
  }), true);
  assert.equal(shouldUseDirectMicLane({
    useRawMicPath: false,
    suppressionRuntimeBackend: 'rnnoise',
    noiseSuppressionEnabled: false,
    webrtcApmBackend: 'webrtc-apm',
  }), true);
  assert.equal(shouldUseDirectMicLane({
    useRawMicPath: false,
    suppressionRuntimeBackend: 'rnnoise',
    noiseSuppressionEnabled: true,
    webrtcApmBackend: 'webrtc-apm',
  }), false);
});
