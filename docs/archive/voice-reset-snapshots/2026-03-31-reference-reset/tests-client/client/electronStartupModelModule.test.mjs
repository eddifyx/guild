import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron startup model owns the runtime profile, server, and flavor helpers', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronStartupRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/electronStartupModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronStartupModel'\)/);
  assert.doesNotMatch(runtimeSource, /function sanitizeProfileId\(/);
  assert.doesNotMatch(runtimeSource, /function sanitizeServerUrl\(/);
  assert.doesNotMatch(runtimeSource, /function getRuntimeProfile\(/);
  assert.doesNotMatch(runtimeSource, /function getRuntimeServerUrl\(/);
  assert.doesNotMatch(runtimeSource, /function detectRuntimeAppFlavor\(/);
  assert.match(modelSource, /function sanitizeProfileId\(/);
  assert.match(modelSource, /function sanitizeServerUrl\(/);
  assert.match(modelSource, /function getRuntimeProfile\(/);
  assert.match(modelSource, /function getRuntimeServerUrl\(/);
  assert.match(modelSource, /function detectRuntimeAppFlavor\(/);
});
