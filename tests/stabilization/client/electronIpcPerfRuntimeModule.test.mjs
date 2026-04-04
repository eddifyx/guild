import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC support runtime delegates debug-log and perf ownership to the dedicated perf runtime', async () => {
  const supportSource = await readFile(
    new URL('../../../client/electron/electronIpcSupportRuntime.js', import.meta.url),
    'utf8'
  );
  const perfSource = await readFile(
    new URL('../../../client/electron/electronIpcPerfRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /require\('\.\/electronIpcPerfRuntime'\)/);
  assert.doesNotMatch(supportSource, /function recordPerfSample\(/);
  assert.doesNotMatch(supportSource, /function getPerfSamples\(/);
  assert.doesNotMatch(supportSource, /function appendDebugLog\(/);
  assert.doesNotMatch(supportSource, /function readDebugLogTail\(/);
  assert.match(perfSource, /function createElectronIpcPerfRuntime\(/);
  assert.match(perfSource, /function recordPerfSample\(/);
  assert.match(perfSource, /function appendDebugLog\(/);
  assert.match(perfSource, /function readDebugLogTail\(/);
});
