import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates apple voice capture session support logic to the dedicated runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureSessionRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/appleVoiceCaptureSessionRuntime'\)/);
  assert.match(mainSource, /createAppleVoiceCaptureRuntime\(\{/);
  assert.match(mainSource, /createAppleVoiceCaptureSessionState,/);
  assert.match(mainSource, /appendAppleVoiceCaptureFrames,/);
  assert.match(mainSource, /applyAppleVoiceCaptureReadyPayload,/);
  assert.match(mainSource, /buildAppleVoiceCaptureEndedError,/);
  assert.doesNotMatch(mainSource, /function readJsonLine\(/);
  assert.match(runtimeSource, /function readAppleVoiceJsonLine\(/);
  assert.match(runtimeSource, /function createAppleVoiceCaptureSessionState\(/);
  assert.match(runtimeSource, /function appendAppleVoiceCaptureFrames\(/);
  assert.match(runtimeSource, /function buildAppleVoiceCaptureEndedError\(/);
});
