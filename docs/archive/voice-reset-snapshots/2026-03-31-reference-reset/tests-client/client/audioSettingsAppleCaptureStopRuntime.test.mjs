import test from 'node:test';
import assert from 'node:assert/strict';

import { stopAudioSettingsAppleCapture } from '../../../client/src/features/voice/audioSettingsAppleCaptureStopRuntime.mjs';

test('audio settings apple capture stop runtime stops the capture owner when provided', async () => {
  const calls = [];

  await stopAudioSettingsAppleCapture({
    stopAppleVoiceCaptureFn: async (...args) => calls.push(args),
    stopAppleVoiceCaptureArgs: ['MIC_TEST'],
  });

  assert.deepEqual(calls, [['MIC_TEST']]);
});

test('audio settings apple capture stop runtime tolerates missing or failing stop handlers', async () => {
  await stopAudioSettingsAppleCapture({});

  await stopAudioSettingsAppleCapture({
    stopAppleVoiceCaptureFn: async () => {
      throw new Error('stop-failed');
    },
    stopAppleVoiceCaptureArgs: ['MIC_TEST'],
  });

  assert.ok(true);
});
