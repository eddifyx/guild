import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsBrowserMicDiagnostics,
  startAudioSettingsBrowserMeterLoop,
} from '../../../client/src/features/voice/audioSettingsBrowserDiagnosticsRuntime.mjs';

test('audio settings browser diagnostics runtime builds the canonical diagnostics payload', () => {
  const diagnostics = buildAudioSettingsBrowserMicDiagnostics({
    updatedAt: '2026-03-26T10:00:00.000Z',
    startedAt: '2026-03-26T09:59:50.000Z',
    activeVoiceMode: 'standard',
    appliedConstraints: { audio: { deviceId: { exact: 'mic-1' } } },
    usedDefaultDeviceFallback: true,
    sourceTrackSummary: { label: 'Mic 1' },
    audioContextSummary: { sampleRate: 48000 },
    filterDiagnostics: { backend: 'raw', loaded: true },
    workletCreateMs: 4,
    monitorPlaybackState: 'live-playing',
    monitorPlaybackError: null,
    outputDeviceId: 'speaker-1',
    outputDeviceLabel: 'Speakers',
    monitorProfileId: 'balanced',
    monitorGain: 0.65,
    requestedOutputDeviceId: 'speaker-1',
    usedDefaultOutputFallback: false,
    getUserMediaMs: 7,
    audioGraphSetupMs: 9,
    monitorSetupMs: 11,
    totalMs: 31,
  });

  assert.deepEqual(diagnostics, {
    updatedAt: '2026-03-26T10:00:00.000Z',
    startedAt: '2026-03-26T09:59:50.000Z',
    mode: 'standard',
    requestedConstraints: { deviceId: { exact: 'mic-1' } },
    usedDefaultDeviceFallback: true,
    sourceTrack: { label: 'Mic 1' },
    audioContext: { sampleRate: 48000 },
    filter: {
      backend: 'raw',
      loaded: true,
      workletCreateMs: 4,
    },
    playback: {
      state: 'live-playing',
      error: null,
      outputDeviceId: 'speaker-1',
      outputDeviceLabel: 'Speakers',
      monitorProfile: 'balanced',
      monitorGain: 0.65,
      requestedOutputDeviceId: 'speaker-1',
      usedDefaultOutputFallback: false,
    },
    timingsMs: {
      getUserMedia: 7,
      audioGraphSetup: 9,
      monitorSetup: 11,
      total: 31,
    },
  });
});

test('audio settings browser diagnostics runtime starts the mic meter loop through the shared scheduler', () => {
  const meterLevels = [];
  const scheduledTicks = [];
  const animFrameRef = { current: null };
  const analyser = {
    frequencyBinCount: 4,
    getByteFrequencyData(data) {
      data.set([64, 64, 64, 64]);
    },
  };

  startAudioSettingsBrowserMeterLoop({
    analyser,
    animFrameRef,
    updateMicMeterFn: (level) => meterLevels.push(level),
    requestAnimationFrameFn: (tick) => {
      scheduledTicks.push(tick);
      return 77;
    },
  });

  assert.equal(meterLevels.length, 1);
  assert.equal(Math.round(meterLevels[0]), 50);
  assert.equal(animFrameRef.current, 77);
  assert.equal(scheduledTicks.length, 1);
});
