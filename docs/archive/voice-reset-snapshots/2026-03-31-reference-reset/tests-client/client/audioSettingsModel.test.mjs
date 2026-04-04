import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLE_VOICE_TEST_START_TIMEOUT_MS,
  RNNOISE_MONITOR_MAKEUP_GAIN,
  buildAudioSettingsViewState,
  buildMicTestConstraints,
  getActiveOutputDevice,
  getMicLevelColor,
  getMicStatusText,
  getMonitorProfile,
  resolveOutputSelection,
  roundMs,
  withTimeout,
} from '../../../client/src/features/voice/audioSettingsModel.mjs';

test('audio settings model rounds durations and derives mic meter presentation', () => {
  assert.equal(roundMs(12.345), 12.3);
  assert.equal(roundMs(NaN), null);
  assert.equal(getMicLevelColor(70), '#00d68f');
  assert.equal(getMicLevelColor(40), '#40FF40');
  assert.equal(getMicLevelColor(10), 'var(--text-muted)');
  assert.equal(getMicStatusText(2), 'No input detected — speak to test');
  assert.equal(getMicStatusText(15), 'Low input — monitoring your mic');
  assert.equal(getMicStatusText(50), 'Mic is working — monitoring your mic');
});

test('audio settings model keeps ultra-low-latency mic test constraints stripped down', () => {
  const lowLatencyConstraints = buildMicTestConstraints({
    mode: 'ultra-low-latency',
    deviceId: 'mic-1',
    noiseSuppressionEnabled: false,
  });
  const standardConstraints = buildMicTestConstraints({
    mode: 'standard',
    deviceId: 'mic-1',
    noiseSuppressionEnabled: true,
  });

  assert.equal(lowLatencyConstraints.audio.deviceId.exact, 'mic-1');
  assert.equal(lowLatencyConstraints.audio.echoCancellation, false);
  assert.equal(standardConstraints.audio.deviceId.exact, 'mic-1');
  assert.equal(typeof standardConstraints.audio.echoCancellation, 'boolean');
});

test('audio settings model resolves output devices and monitor profiles consistently', () => {
  const outputDevices = [
    { deviceId: 'default', label: 'Built-in Speakers' },
    { deviceId: 'airpods', label: 'AirPods Pro' },
  ];

  assert.equal(getActiveOutputDevice(outputDevices, 'airpods').label, 'AirPods Pro');
  assert.equal(getActiveOutputDevice(outputDevices, 'missing').label, 'Built-in Speakers');

  assert.deepEqual(resolveOutputSelection(outputDevices, 'missing'), {
    activeOutput: outputDevices[0],
    activeOutputId: 'default',
    hasExplicitSelection: true,
    usedDefaultFallback: true,
  });

  assert.equal(getMonitorProfile(outputDevices, 'airpods').id, 'full');
  assert.equal(getMonitorProfile(outputDevices, 'default').id, 'speaker-safe');

  assert.deepEqual(buildAudioSettingsViewState({
    processingMode: 'standard',
    outputDevices,
    selectedOutput: 'default',
    testDiagnostics: { filter: { fallbackReason: 'fallback active' } },
    liveVoiceFallbackReason: null,
  }), {
    lowLatencyEnabled: false,
    activeMonitorProfile: {
      id: 'speaker-safe',
      gain: 0.5,
      label: 'Built-in Speakers',
      hint: 'Speaker-safe monitor level is on to cut down feedback. Headphones will sound cleaner.',
    },
    noiseSuppressionFallbackReason: 'fallback active',
  });
});

test('audio settings model does not leak live voice fallback state into mic test diagnostics', () => {
  assert.deepEqual(buildAudioSettingsViewState({
    processingMode: 'standard',
    outputDevices: [{ deviceId: 'default', label: 'Built-in Speakers' }],
    selectedOutput: 'default',
    testDiagnostics: null,
    liveVoiceFallbackReason: 'Voice safe mode active',
  }), {
    lowLatencyEnabled: false,
    activeMonitorProfile: {
      id: 'speaker-safe',
      gain: 0.5,
      label: 'Built-in Speakers',
      hint: 'Speaker-safe monitor level is on to cut down feedback. Headphones will sound cleaner.',
    },
    noiseSuppressionFallbackReason: null,
  });
});

test('audio settings model timeout helper settles through the injected window timing APIs', async () => {
  const scheduled = [];
  const cleared = [];
  const fakeWindow = {
    setTimeout(callback, timeoutMs) {
      scheduled.push(timeoutMs);
      return callback;
    },
    clearTimeout(callback) {
      cleared.push(callback);
    },
  };

  const resolved = await withTimeout(Promise.resolve('ok'), 25, 'boom', fakeWindow);
  assert.equal(resolved, 'ok');
  assert.equal(scheduled[0], 25);
  assert.equal(cleared.length, 1);
});

test('audio settings model exports stable monitor constants', () => {
  assert.equal(RNNOISE_MONITOR_MAKEUP_GAIN, 2.4);
  assert.equal(APPLE_VOICE_TEST_START_TIMEOUT_MS, 3200);
});
