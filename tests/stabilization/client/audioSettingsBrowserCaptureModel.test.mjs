import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsBrowserGraphResult,
  buildAudioSettingsBrowserSuppressionState,
} from '../../../client/src/features/voice/audioSettingsBrowserCaptureModel.mjs';

test('audio settings browser capture model derives suppression state and filter diagnostics canonically', () => {
  const state = buildAudioSettingsBrowserSuppressionState({
    activeVoiceMode: 'standard',
    noiseSuppressionEnabled: true,
    sourceTrack: { kind: 'audio' },
    requestedSuppressionRuntime: {
      backend: 'rnnoise',
    },
    useRawMicPath: false,
    resolveNoiseSuppressionRuntimeStateFn: () => ({
      backend: 'webrtc-apm',
      requiresWarmup: false,
      fallbackReason: null,
    }),
    voiceNoiseSuppressionBackends: {
      WEBRTC_APM: 'webrtc-apm',
      RNNOISE: 'rnnoise',
    },
  });

  assert.equal(state.suppressionRuntime.backend, 'webrtc-apm');
  assert.equal(state.usesBrowserApm, true);
  assert.equal(state.usesRnnoise, false);
  assert.equal(state.filterDiagnostics.backend, 'webrtc-apm');
  assert.equal(state.filterDiagnostics.requestedBackend, 'rnnoise');
  assert.equal(state.filterDiagnostics.loaded, true);
});

test('audio settings browser capture model builds the canonical graph result shape', () => {
  const ctx = { sampleRate: 48000 };
  const sourceTrack = { kind: 'audio' };
  const result = buildAudioSettingsBrowserGraphResult({
    ctx,
    source: { id: 'source-1' },
    gain: { id: 'gain-1' },
    analyser: { id: 'analyser-1' },
    sourceTrack,
    suppressionRuntime: { backend: 'raw' },
    usesRnnoise: false,
    filterDiagnostics: { backend: 'raw' },
    audioGraphSetupMs: 5,
    workletCreateMs: null,
    monitorSetupMs: 7,
    monitorPlaybackState: 'live-playing',
    monitorPlaybackError: null,
    summarizeTrackSnapshotFn: () => ({ label: 'mic-1' }),
    summarizeAudioContextFn: () => ({ sampleRate: 48000 }),
    requestedOutputDeviceId: 'speaker-1',
    activeOutputId: 'speaker-1',
    monitorProfile: { id: 'balanced', gain: 0.75, label: 'Speakers' },
    outputSelection: { usedDefaultFallback: false },
  });

  assert.equal(result.ctx, ctx);
  assert.equal(result.monitorPlaybackState, 'live-playing');
  assert.equal(result.outputDeviceId, 'speaker-1');
  assert.equal(result.outputDeviceLabel, 'Speakers');
  assert.equal(result.monitorProfileId, 'balanced');
  assert.equal(result.monitorGain, 0.75);
  assert.equal(result.usedDefaultOutputFallback, false);
  assert.deepEqual(result.sourceTrackSummary, { label: 'mic-1' });
  assert.deepEqual(result.audioContextSummary, { sampleRate: 48000 });
});

test('audio settings browser capture model can force a direct fallback path after Apple cleanup fails', () => {
  const state = buildAudioSettingsBrowserSuppressionState({
    activeVoiceMode: 'standard',
    noiseSuppressionEnabled: true,
    sourceTrack: { kind: 'audio' },
    requestedSuppressionRuntime: {
      backend: 'apple-voice-processing',
    },
    useRawMicPath: false,
    preferDirectBrowserFallback: true,
    resolveNoiseSuppressionRuntimeStateFn: () => ({
      backend: 'rnnoise',
      requiresWarmup: true,
      fallbackReason: 'should-not-be-used',
    }),
    voiceNoiseSuppressionBackends: {
      WEBRTC_APM: 'webrtc-apm',
      RNNOISE: 'rnnoise',
    },
  });

  assert.equal(state.suppressionRuntime.backend, 'raw');
  assert.equal(state.suppressionRuntime.requestedBackend, 'apple-voice-processing');
  assert.equal(state.usesBrowserApm, false);
  assert.equal(state.usesRnnoise, false);
  assert.equal(state.filterDiagnostics.backend, 'raw');
  assert.equal(state.filterDiagnostics.requestedBackend, 'apple-voice-processing');
  assert.equal(state.filterDiagnostics.loaded, true);
  assert.equal(state.filterDiagnostics.requiresWarmup, false);
  assert.equal(state.filterDiagnostics.fallbackReason, null);
});
