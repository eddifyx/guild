import test from 'node:test';
import assert from 'node:assert/strict';

import { switchVoiceCaptureRoutingMode } from '../../../client/src/features/voice/voiceCaptureRoutingMode.mjs';

test('voice capture routing mode returns raw success when no routing exists and raw mode is requested', () => {
  const result = switchVoiceCaptureRoutingMode({
    capture: {},
    nextMode: 'ultra-low-latency',
    isUltraLowLatencyModeFn: (mode) => mode === 'ultra-low-latency',
  });

  assert.deepEqual(result, {
    handled: true,
    wantsProcessedLane: false,
    usingProcessedLane: false,
    activeBackend: 'raw',
    fallbackReason: null,
  });
});

test('voice capture routing mode refuses processed mode when routing is missing', () => {
  const result = switchVoiceCaptureRoutingMode({
    capture: {},
    nextMode: 'studio',
    isUltraLowLatencyModeFn: () => false,
  });

  assert.deepEqual(result, {
    handled: false,
    reason: 'missing-routing',
    wantsProcessedLane: true,
  });
});

test('voice capture routing mode refuses processed mode when processed routing is not ready', () => {
  const result = switchVoiceCaptureRoutingMode({
    capture: {
      routing: {
        processedReady: false,
      },
    },
    nextMode: 'studio',
    isUltraLowLatencyModeFn: () => false,
  });

  assert.deepEqual(result, {
    handled: false,
    reason: 'processed-not-ready',
    wantsProcessedLane: true,
  });
});

test('voice capture routing mode reports Apple backend when processed routing stays active', () => {
  const routing = {
    processedReady: true,
  };

  const result = switchVoiceCaptureRoutingMode({
    capture: {
      routing,
      usesAppleVoiceProcessing: true,
      noiseSuppressorNode: null,
    },
    nextMode: 'studio',
    isUltraLowLatencyModeFn: () => false,
    applyNoiseSuppressionRoutingFn: (nextRouting, enabled) => {
      assert.equal(nextRouting, routing);
      assert.equal(enabled, true);
      return true;
    },
  });

  assert.deepEqual(result, {
    handled: true,
    wantsProcessedLane: true,
    usingProcessedLane: true,
    activeBackend: 'apple',
    fallbackReason: null,
  });
});

test('voice capture routing mode reports fallback when processed lane cannot stay active', () => {
  const result = switchVoiceCaptureRoutingMode({
    capture: {
      routing: {
        processedReady: true,
      },
      usesAppleVoiceProcessing: false,
      noiseSuppressorNode: { id: 'rnnoise' },
    },
    nextMode: 'studio',
    isUltraLowLatencyModeFn: () => false,
    applyNoiseSuppressionRoutingFn: () => false,
  });

  assert.deepEqual(result, {
    handled: true,
    wantsProcessedLane: true,
    usingProcessedLane: false,
    activeBackend: 'raw',
    fallbackReason: 'Noise suppression is unavailable right now.',
  });
});
