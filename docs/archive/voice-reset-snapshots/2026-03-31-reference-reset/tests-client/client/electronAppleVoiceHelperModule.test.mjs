import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates apple voice helper support logic to the dedicated runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceHelperRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/appleVoiceHelperRuntime'\)/);
  assert.match(mainSource, /createAppleVoiceHelperRuntime\(/);
  assert.doesNotMatch(mainSource, /async function ensureAppleVoiceHelperBinary\(/);
  assert.doesNotMatch(mainSource, /function getAppleVoiceHelperSourceCandidates\(/);
  assert.doesNotMatch(mainSource, /function getAppleVoiceHelperBinaryCandidates\(/);
  assert.doesNotMatch(mainSource, /function normalizeAppleVoiceCaptureOwnerId\(/);
  assert.doesNotMatch(mainSource, /function shouldDisableAppleVoiceCaptureForMessage\(/);
  assert.match(runtimeSource, /function createAppleVoiceHelperRuntime\(/);
  assert.match(runtimeSource, /function isAppleVoiceCapturePlatformSupported\(/);
  assert.match(runtimeSource, /async function ensureAppleVoiceHelperBinary\(/);
});
