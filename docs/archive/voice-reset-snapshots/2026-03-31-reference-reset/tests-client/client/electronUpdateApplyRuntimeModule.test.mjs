import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron update runtime delegates platform apply helpers to the dedicated apply runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/updateRuntime.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/updateApplyRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/updateApplyModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/updateApplyRuntime'\)/);
  assert.match(runtimeSource, /applyExtractedUpdate\(/);
  assert.match(helperSource, /require\('\.\/updateApplyModel'\)/);
  assert.doesNotMatch(runtimeSource, /function buildMacUpdateScript\(/);
  assert.doesNotMatch(runtimeSource, /function buildWindowsUpdateScript\(/);
  assert.match(helperSource, /function applyExtractedUpdate\(/);
  assert.doesNotMatch(helperSource, /function buildMacUpdateScript\(/);
  assert.doesNotMatch(helperSource, /function buildWindowsUpdateScript\(/);
  assert.match(modelSource, /function buildMacUpdateScript\(/);
  assert.match(modelSource, /function buildWindowsUpdateScript\(/);
});
