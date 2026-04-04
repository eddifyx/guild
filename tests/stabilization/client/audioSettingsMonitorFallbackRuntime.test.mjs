import test from 'node:test';
import assert from 'node:assert/strict';

import { fallbackAudioSettingsMonitorOutput } from '../../../client/src/features/voice/audioSettingsMonitorFallbackRuntime.mjs';

test('audio settings monitor fallback runtime clears preview playback, reroutes output, and builds the canonical result', () => {
  const calls = [];

  const result = fallbackAudioSettingsMonitorOutput({
    clearPreviewPlaybackFn: () => calls.push('clear'),
    monitorGain: {
      disconnect(target) {
        calls.push(['disconnect', target]);
      },
      connect(target) {
        calls.push(['connect', target]);
      },
    },
    previewDestination: { id: 'preview-destination' },
    destination: { id: 'main-destination' },
    playbackError: 'sink-failed',
    previewStart: 10,
    performanceNowFn: () => 18.4,
  });

  assert.deepEqual(calls, [
    'clear',
    ['disconnect', { id: 'preview-destination' }],
    ['connect', { id: 'main-destination' }],
  ]);
  assert.deepEqual(result, {
    mode: 'direct-fallback',
    playbackState: 'live-playing',
    playbackError: 'sink-failed',
    monitorSetupMs: 8.4,
  });
});

test('audio settings monitor fallback runtime tolerates disconnect failures and preserves explicit mode and state', () => {
  const calls = [];

  const result = fallbackAudioSettingsMonitorOutput({
    clearPreviewPlaybackFn: () => calls.push('clear'),
    monitorGain: {
      disconnect() {
        calls.push('disconnect');
        throw new Error('disconnect-failed');
      },
      connect(target) {
        calls.push(['connect', target]);
      },
    },
    previewDestination: { id: 'preview-destination' },
    destination: { id: 'main-destination' },
    mode: 'sink',
    playbackState: 'starting',
    playbackError: 'play-failed',
    previewStart: 2,
    performanceNowFn: () => 5.5,
  });

  assert.deepEqual(calls, [
    'clear',
    'disconnect',
    ['connect', { id: 'main-destination' }],
  ]);
  assert.deepEqual(result, {
    mode: 'sink',
    playbackState: 'starting',
    playbackError: 'play-failed',
    monitorSetupMs: 3.5,
  });
});
