import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller runtime/view owner wires runtime, effects, and view state through shared inputs', async () => {
  const runtimeViewSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerRuntimeView.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeViewSource, /function useMainLayoutControllerRuntimeView\(/);
  assert.match(runtimeViewSource, /buildMainLayoutControllerRuntimeInput\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerRuntime\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerEffects\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerViewState\(/);
});
