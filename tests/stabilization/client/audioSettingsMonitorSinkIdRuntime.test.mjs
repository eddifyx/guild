import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAudioSettingsMonitorSinkId } from '../../../client/src/features/voice/audioSettingsMonitorSinkIdRuntime.mjs';

test('audio settings monitor sink-id runtime returns null when sink routing succeeds', async () => {
  const previewAudio = {
    async setSinkId(requestedId) {
      assert.equal(requestedId, 'speaker-1');
    },
  };

  const result = await applyAudioSettingsMonitorSinkId({
    previewAudio,
    activeOutputId: 'speaker-1',
  });

  assert.equal(result, null);
});

test('audio settings monitor sink-id runtime falls back when sink routing is unavailable or fails', async () => {
  const calls = [];

  const withoutSinkResult = await applyAudioSettingsMonitorSinkId({
    previewAudio: {},
    activeOutputId: 'speaker-2',
    fallbackArgs: {
      clearPreviewPlaybackFn: () => calls.push('clear:no-sink'),
      monitorGain: {
        disconnect(target) {
          calls.push(['disconnect:no-sink', target]);
        },
        connect(target) {
          calls.push(['connect:no-sink', target]);
        },
      },
      previewDestination: { id: 'preview-destination' },
      destination: { id: 'main-destination' },
      previewStart: 10,
      performanceNowFn: () => 16.5,
    },
  });

  assert.equal(withoutSinkResult.mode, 'direct-fallback');
  assert.match(withoutSinkResult.playbackError, /unavailable here/i);

  const withErrorResult = await applyAudioSettingsMonitorSinkId({
    previewAudio: {
      async setSinkId() {
        throw new Error('sink-failed');
      },
    },
    activeOutputId: 'speaker-3',
    fallbackArgs: {
      clearPreviewPlaybackFn: () => calls.push('clear:error'),
      monitorGain: {
        disconnect(target) {
          calls.push(['disconnect:error', target]);
        },
        connect(target) {
          calls.push(['connect:error', target]);
        },
      },
      previewDestination: { id: 'preview-destination' },
      destination: { id: 'main-destination' },
      previewStart: 20,
      performanceNowFn: () => 29.2,
    },
  });

  assert.equal(withErrorResult.mode, 'direct-fallback');
  assert.equal(withErrorResult.playbackError, 'sink-failed');
  assert.deepEqual(calls, [
    'clear:no-sink',
    ['disconnect:no-sink', { id: 'preview-destination' }],
    ['connect:no-sink', { id: 'main-destination' }],
    'clear:error',
    ['disconnect:error', { id: 'preview-destination' }],
    ['connect:error', { id: 'main-destination' }],
  ]);
});
