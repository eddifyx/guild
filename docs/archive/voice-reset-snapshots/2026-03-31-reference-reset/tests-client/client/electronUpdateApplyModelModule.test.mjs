import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron update apply runtime delegates pure apply helpers to the dedicated model module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/updateApplyRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/updateApplyModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/updateApplyModel'\)/);
  assert.match(runtimeSource, /function applyExtractedUpdate\(/);
  assert.doesNotMatch(runtimeSource, /function buildMacUpdateScript\(/);
  assert.doesNotMatch(runtimeSource, /function buildWindowsUpdateScript\(/);
  assert.doesNotMatch(runtimeSource, /function resolveUpdateSourceDir\(/);
  assert.match(modelSource, /function buildMacUpdateScript\(/);
  assert.match(modelSource, /function buildWindowsUpdateScript\(/);
  assert.match(modelSource, /function resolveUpdateSourceDir\(/);
});
