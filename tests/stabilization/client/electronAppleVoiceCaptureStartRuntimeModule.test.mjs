import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron apple voice capture start runtime owns the start-session lifecycle', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureRuntime.js', import.meta.url),
    'utf8'
  );
  const startSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureStartRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/appleVoiceCaptureStartRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /async function startAppleVoiceCaptureSession\(/);
  assert.match(startSource, /function createAppleVoiceCaptureStartRuntime\(/);
  assert.match(startSource, /async function startAppleVoiceCaptureSession\(/);
  assert.match(startSource, /module\.exports = \{/);
});
