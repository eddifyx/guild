import test from 'node:test';
import assert from 'node:assert/strict';

import { startAudioSettingsMonitorPlayback } from '../../../client/src/features/voice/audioSettingsMonitorPlaybackRuntime.mjs';

test('audio settings monitor playback runtime waits for readiness and returns the canonical sink result', async () => {
  const listeners = [];
  const previewAudio = {
    readyState: 0,
    addEventListener(event, handler) {
      listeners.push(event);
      if (event === 'loadedmetadata') {
        handler();
      }
    },
    async play() {},
  };

  const result = await startAudioSettingsMonitorPlayback({
    previewAudio,
    haveMetadataReadyState: 1,
    setTimeoutFn: () => {},
    previewStart: 100,
    performanceNowFn: () => 112.4,
  });

  assert.deepEqual(listeners, ['loadedmetadata', 'canplay']);
  assert.deepEqual(result, {
    mode: 'sink',
    playbackState: 'live-playing',
    playbackError: null,
    monitorSetupMs: 12.4,
  });
});

test('audio settings monitor playback runtime falls back when playback fails', async () => {
  const calls = [];
  const previewAudio = {
    readyState: 2,
    addEventListener() {},
    async play() {
      throw new Error('play-failed');
    },
  };

  const result = await startAudioSettingsMonitorPlayback({
    previewAudio,
    haveMetadataReadyState: 1,
    setTimeoutFn: () => {},
    previewStart: 40,
    performanceNowFn: () => 44.6,
    fallbackArgs: {
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
      previewStart: 40,
      performanceNowFn: () => 44.6,
    },
  });

  assert.deepEqual(calls, [
    'clear',
    ['disconnect', { id: 'preview-destination' }],
    ['connect', { id: 'main-destination' }],
  ]);
  assert.deepEqual(result, {
    mode: 'sink',
    playbackState: 'live-playing',
    playbackError: 'play-failed',
    monitorSetupMs: 4.6,
  });
});
