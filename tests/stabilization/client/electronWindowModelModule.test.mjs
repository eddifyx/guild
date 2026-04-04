import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window model owns pure window query and BrowserWindow option shaping', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronWindowRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/electronWindowModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronWindowModel'\)/);
  assert.doesNotMatch(runtimeSource, /function buildWindowRuntimeQuery\(/);
  assert.doesNotMatch(runtimeSource, /function buildBrowserWindowOptions\(/);
  assert.match(modelSource, /function buildWindowRuntimeQuery\(/);
  assert.match(modelSource, /function buildBrowserWindowOptions\(/);
});
