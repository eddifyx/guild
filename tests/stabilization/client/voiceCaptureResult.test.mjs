import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProcessedVoiceCaptureResult,
  buildSafeModeVoiceCaptureResult,
  buildVoiceCaptureErrorResult,
} from '../../../client/src/features/voice/voiceCaptureResult.mjs';

test('voice capture result builds an error payload with normalized diagnostics', () => {
  const result = buildVoiceCaptureErrorResult({
    chId: 'channel-1',
    captureStartedAt: '2026-03-25T12:00:00.000Z',
    activeVoiceProcessingMode: 'studio',
    appliedConstraints: {
      audio: { echoCancellation: true },
    },
    usedDefaultDeviceFallback: true,
    requestedSuppressionRuntime: { backend: 'rnnoise' },
    noiseSuppressionEnabled: true,
    useRawMicPath: false,
    getUserMediaMs: 12,
    totalMs: 18,
    micErr: new Error('Mic denied'),
    createVoiceFilterDiagnosticsFn: (payload) => ({
      backend: payload.suppressionRuntime.backend,
      loaded: false,
      fallbackReason: null,
    }),
    buildVoiceCaptureDiagnosticsFn: (payload) => payload,
  });

  assert.equal(result.error.message, 'Mic denied');
  assert.deepEqual(result.diagnostics, {
    channelId: 'channel-1',
    startedAt: '2026-03-25T12:00:00.000Z',
    mode: 'studio',
    requestedConstraints: { echoCancellation: true },
    usedDefaultDeviceFallback: true,
    reusedSourceStream: false,
    filter: {
      backend: 'rnnoise',
      loaded: false,
      fallbackReason: null,
    },
    getUserMediaMs: 12,
    totalMs: 18,
    error: 'Mic denied',
  });
});

test('voice capture result builds a safe-mode payload with raw-filter diagnostics', () => {
  const capture = {
    outputTrack: { id: 'track-1' },
    outputTrackMode: 'voice-safe-mode-direct-source',
    micCtx: { id: 'ctx-1' },
  };

  const result = buildSafeModeVoiceCaptureResult({
    capture,
    chId: 'channel-2',
    captureStartedAt: '2026-03-25T12:00:00.000Z',
    activeVoiceProcessingMode: 'ultra-low-latency',
    appliedConstraints: {
      audio: { autoGainControl: false },
    },
    usedDefaultDeviceFallback: false,
    reusedExistingStream: true,
    sourceTrack: { id: 'source-1' },
    getUserMediaMs: 10,
    audioGraphSetupMs: 6,
    totalMs: 17,
    filterDiagnostics: {
      backend: 'apple',
      loaded: false,
      requiresWarmup: true,
      fallbackReason: null,
    },
    summarizeTrackSnapshotFn: (track) => track ? track.id : null,
    summarizeAudioContextFn: (ctx) => ctx ? ctx.id : null,
    buildVoiceCaptureDiagnosticsFn: (payload) => payload,
  });

  assert.equal(result.noiseSuppressionEnabled, false);
  assert.deepEqual(result.diagnostics.filter, {
    backend: 'raw',
    loaded: true,
    requiresWarmup: false,
    fallbackReason: 'Voice safe mode active',
    workletCreateMs: null,
  });
  assert.equal(result.diagnostics.producedTrack, 'track-1');
  assert.equal(result.diagnostics.audioContext, 'ctx-1');
});

test('voice capture result builds a processed capture payload with worklet timing', () => {
  const capture = {
    outputTrack: { id: 'track-2' },
    outputTrackMode: 'processed-destination',
  };

  const result = buildProcessedVoiceCaptureResult({
    capture,
    chId: 'channel-3',
    captureStartedAt: '2026-03-25T12:00:00.000Z',
    activeVoiceProcessingMode: 'studio',
    appliedConstraints: {
      audio: { noiseSuppression: true },
    },
    usedDefaultDeviceFallback: false,
    reusedExistingStream: false,
    sourceTrack: { id: 'source-2' },
    micCtx: { id: 'ctx-2' },
    filterDiagnostics: {
      backend: 'rnnoise',
      loaded: true,
      fallbackReason: null,
    },
    workletCreateMs: 11,
    getUserMediaMs: 9,
    audioGraphSetupMs: 5,
    totalMs: 20,
    noiseSuppressionEnabled: true,
    summarizeTrackSnapshotFn: (track) => track ? track.id : null,
    summarizeAudioContextFn: (ctx) => ctx ? ctx.id : null,
    buildVoiceCaptureDiagnosticsFn: (payload) => payload,
  });

  assert.equal(result.noiseSuppressionEnabled, true);
  assert.deepEqual(result.diagnostics.filter, {
    backend: 'rnnoise',
    loaded: true,
    fallbackReason: null,
    workletCreateMs: 11,
  });
  assert.equal(result.diagnostics.sourceTrack, 'source-2');
  assert.equal(result.diagnostics.producedTrack, 'track-2');
  assert.equal(result.diagnostics.audioContext, 'ctx-2');
});
