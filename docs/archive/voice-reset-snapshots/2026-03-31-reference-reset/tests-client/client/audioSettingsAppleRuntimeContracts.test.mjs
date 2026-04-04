import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsAppleCleanupInput,
  buildAudioSettingsAppleStateFallbackUpdater,
  buildAudioSettingsAppleSuccessDiagnostics,
} from '../../../client/src/features/voice/audioSettingsAppleRuntimeContracts.mjs';

test('audio settings apple runtime contracts build cleanup input through canonical refs', () => {
  const refs = {
    appleVoiceFrameCleanupRef: { current: null },
    appleVoiceStateCleanupRef: { current: null },
    appleVoiceSourceNodeRef: { current: null },
    previewAudioRef: { current: null },
    audioCtxRef: { current: null },
  };
  const stopAppleVoiceCaptureFn = async () => {};

  const input = buildAudioSettingsAppleCleanupInput({
    refs,
    stopAppleVoiceCaptureFn,
  });

  assert.equal(input.refs.appleVoiceFrameCleanupRef, refs.appleVoiceFrameCleanupRef);
  assert.equal(input.refs.audioCtxRef, refs.audioCtxRef);
  assert.equal(input.deps.stopAppleVoiceCaptureFn, stopAppleVoiceCaptureFn);
});

test('audio settings apple runtime contracts build success diagnostics canonically', () => {
  const diagnostics = buildAudioSettingsAppleSuccessDiagnostics({
    testStartedAt: '2026-03-26T12:00:00.000Z',
    activeVoiceMode: 'standard',
    helperMetadata: { sampleRate: 48000, channels: 1 },
    summarizeAudioContextFn: () => ({ sampleRate: 48000 }),
    ctx: { state: 'running' },
    voiceNoiseSuppressionBackendApple: 'apple-voice-processing',
    noiseSuppressionEnabled: true,
    helperStartMs: 11,
    monitorPlaybackState: 'live-playing',
    monitorPlaybackError: null,
    activeOutputId: 'speaker-1',
    monitorProfile: { id: 'balanced', gain: 0.65, label: 'Studio Speakers' },
    requestedOutputDeviceId: 'speaker-1',
    usedDefaultOutputFallback: false,
    audioGraphSetupMs: 5,
    monitorSetupMs: 6,
    totalMs: 25,
  });

  assert.equal(diagnostics.mode, 'standard');
  assert.equal(diagnostics.filter.backend, 'apple-voice-processing');
  assert.equal(diagnostics.sourceTrack.settings.sampleRate, 48000);
  assert.equal(diagnostics.playback.outputDeviceLabel, 'Studio Speakers');
  assert.equal(diagnostics.timingsMs.total, 25);
});

test('audio settings apple runtime contracts build fallback updater through canonical interrupted state', () => {
  const prev = {
    filter: {
      backend: 'apple-voice-processing',
      suppressionEnabled: true,
      loaded: true,
    },
    playback: {
      state: 'live-playing',
    },
  };

  const next = buildAudioSettingsAppleStateFallbackUpdater({
    payload: { message: 'helper-ended' },
    noiseSuppressionEnabled: true,
    getFriendlyAppleVoiceFallbackMessageFn: (message) => `fallback:${message}`,
  })(prev);

  assert.equal(next.filter.backend, 'raw');
  assert.equal(next.filter.loaded, false);
  assert.equal(next.filter.fallbackReason, 'fallback:helper-ended');
  assert.equal(next.playback.state, 'interrupted');
});
