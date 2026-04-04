import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates apple voice capture lifecycle logic to the dedicated runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureRuntime.js', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureSupportRuntime.js', import.meta.url),
    'utf8'
  );
  const startSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureStartRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/appleVoiceCaptureRuntime'\)/);
  assert.match(mainSource, /createAppleVoiceCaptureRuntime\(/);
  assert.doesNotMatch(mainSource, /async function primeAppleVoiceCapture\(/);
  assert.doesNotMatch(mainSource, /async function startAppleVoiceCaptureSession\(/);
  assert.doesNotMatch(mainSource, /function stopAppleVoiceCaptureSession\(/);
  assert.match(runtimeSource, /function createAppleVoiceCaptureRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/appleVoiceCaptureSupportRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/appleVoiceCaptureStartRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function markAppleVoiceCaptureUnavailable\(/);
  assert.doesNotMatch(runtimeSource, /async function startAppleVoiceCaptureSession\(/);
  assert.match(runtimeSource, /module\.exports = \{/);
  assert.match(supportSource, /function markAppleVoiceCaptureUnavailable\(/);
  assert.match(startSource, /async function startAppleVoiceCaptureSession\(/);
});
