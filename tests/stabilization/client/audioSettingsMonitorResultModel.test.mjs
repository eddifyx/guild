import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioSettingsMonitorResult } from '../../../client/src/features/voice/audioSettingsMonitorResultModel.mjs';

test('audio settings monitor result model shapes default live playback state', () => {
  const result = buildAudioSettingsMonitorResult({
    mode: 'direct',
    previewStart: 100,
    performanceNowFn: () => 112.6,
  });

  assert.deepEqual(result, {
    mode: 'direct',
    playbackState: 'live-playing',
    playbackError: null,
    monitorSetupMs: 12.6,
  });
});

test('audio settings monitor result model preserves explicit playback fields', () => {
  const result = buildAudioSettingsMonitorResult({
    mode: 'sink',
    playbackState: 'starting',
    playbackError: 'preview-failed',
    previewStart: 50,
    performanceNowFn: () => 59.2,
  });

  assert.deepEqual(result, {
    mode: 'sink',
    playbackState: 'starting',
    playbackError: 'preview-failed',
    monitorSetupMs: 9.2,
  });
});
