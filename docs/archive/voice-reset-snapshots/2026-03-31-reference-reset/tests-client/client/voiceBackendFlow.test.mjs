import test from 'node:test';
import assert from 'node:assert/strict';

import { startVoiceCaptureBackend } from '../../../client/src/features/voice/voiceBackendFlow.mjs';

function createNode() {
  return {
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
  };
}

test('voice backend flow uses the direct mic lane when policy says to bypass processing', async () => {
  const micSource = createNode();
  const gainNode = createNode();

  const result = await startVoiceCaptureBackend({
    micSource,
    gainNode,
    suppressionRuntime: {
      backend: 'webrtc-apm',
    },
    noiseSuppressionEnabled: true,
    shouldUseDirectMicLaneFn: () => true,
  });

  assert.equal(result.backendMode, 'direct');
  assert.deepEqual(micSource.connections, [gainNode]);
});

test('voice backend flow starts the Apple hardware cleanup lane for live voice', async () => {
  const micSource = createNode();
  const gainNode = createNode();
  const filterDiagnostics = {
    backend: 'apple-voice-processing',
    requestedBackend: 'apple-voice-processing',
    requiresWarmup: true,
    fallbackReason: 'stale',
    loaded: false,
  };

  const appleStartCalls = [];

  const result = await startVoiceCaptureBackend({
    micSource,
    gainNode,
    suppressionRuntime: {
      backend: 'apple-voice-processing',
    },
    requestedSuppressionRuntime: {
      backend: 'apple-voice-processing',
    },
    noiseSuppressionEnabled: true,
    filterDiagnostics,
    shouldUseDirectMicLaneFn: () => false,
    startAppleProcessingLaneFn: async () => {
      appleStartCalls.push('started');
      return { workletCreateMs: 12.5 };
    },
  });

  assert.equal(result.backendMode, 'apple');
  assert.equal(result.workletCreateMs, 12.5);
  assert.equal(appleStartCalls.length, 1);
  assert.deepEqual(micSource.connections, []);
  assert.deepEqual(filterDiagnostics, {
    backend: 'apple-voice-processing',
    requestedBackend: 'apple-voice-processing',
    requiresWarmup: true,
    fallbackReason: 'stale',
    loaded: false,
  });
});

test('voice backend flow falls back from Apple to the direct mic lane and updates filter diagnostics', async () => {
  const filterDiagnostics = {
    backend: 'apple-voice-processing',
    requestedBackend: 'apple-voice-processing',
    requiresWarmup: true,
    fallbackReason: null,
    loaded: true,
  };
  const appleVoiceAvailableRef = { current: true };
  const cleanupCalls = [];
  const micSource = createNode();
  const gainNode = createNode();

  const result = await startVoiceCaptureBackend({
    capture: {},
    micSource,
    gainNode,
    suppressionRuntime: {
      backend: 'apple-voice-processing',
    },
    activeVoiceProcessingMode: 'studio',
    noiseSuppressionEnabled: true,
    requestedSuppressionRuntime: {
      backend: 'apple-voice-processing',
    },
    filterDiagnostics,
    appleVoiceAvailableRef,
    startAppleProcessingLaneFn: async () => {
      throw new Error('apple helper unavailable');
    },
    cleanupAppleLaneFn: async (payload) => {
      cleanupCalls.push(payload);
    },
    shouldUseDirectMicLaneFn: () => false,
    shouldDisableAppleVoiceForSessionFn: (message) => message.includes('unavailable'),
    buildAppleDirectFallbackSuppressionRuntimeFn: () => ({
      backend: 'raw',
      requiresWarmup: false,
      requestedBackend: 'apple-voice-processing',
      fallbackReason: null,
    }),
    getFriendlyAppleVoiceFallbackMessageFn: (message) => `friendly:${message}`,
  });

  assert.equal(result.backendMode, 'apple-fallback-direct');
  assert.equal(result.workletCreateMs, null);
  assert.equal(appleVoiceAvailableRef.current, false);
  assert.deepEqual(cleanupCalls, [{ releaseOwner: true }]);
  assert.deepEqual(micSource.connections, [gainNode]);
  assert.deepEqual(filterDiagnostics, {
    backend: 'raw',
    requestedBackend: 'apple-voice-processing',
    requiresWarmup: false,
    fallbackReason: null,
    loaded: true,
  });
});

test('voice backend flow falls back to raw when RNNoise startup fails', async () => {
  const fallbackCalls = [];
  const filterDiagnostics = {
    backend: 'rnnoise',
    fallbackReason: null,
    loaded: false,
  };

  const result = await startVoiceCaptureBackend({
    capture: { id: 'capture-1' },
    micSource: createNode(),
    gainNode: createNode(),
    suppressionRuntime: {
      backend: 'rnnoise',
    },
    noiseSuppressionEnabled: true,
    filterDiagnostics,
    startRnnoiseProcessingLaneFn: async () => {
      throw new Error('rnnoise init failed');
    },
    shouldUseDirectMicLaneFn: () => false,
    applyVoiceProcessingFallbackStateFn: (capture, diagnostics, options) => {
      fallbackCalls.push([capture, diagnostics, options]);
    },
  });

  assert.equal(result.backendMode, 'raw');
  assert.equal(fallbackCalls.length, 1);
  assert.equal(fallbackCalls[0][2].fallbackReason, 'rnnoise init failed');
});
