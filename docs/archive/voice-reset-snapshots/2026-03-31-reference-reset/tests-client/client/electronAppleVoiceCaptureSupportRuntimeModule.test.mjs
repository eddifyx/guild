import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron apple voice capture runtime delegates support and stop helpers to the dedicated support runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureRuntime.js', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureSupportRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/appleVoiceCaptureSupportRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function markAppleVoiceCaptureUnavailable\(/);
  assert.doesNotMatch(runtimeSource, /async function primeAppleVoiceCapture\(/);
  assert.doesNotMatch(runtimeSource, /function stopAppleVoiceCaptureSession\(/);
  assert.match(supportSource, /function markAppleVoiceCaptureUnavailable\(/);
  assert.match(supportSource, /async function primeAppleVoiceCapture\(/);
  assert.match(supportSource, /function stopAppleVoiceCaptureSession\(/);
});
