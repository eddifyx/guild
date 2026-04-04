import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller delegates derived voice and shell state to a dedicated hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutController.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerDerivedState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useMainLayoutControllerDerivedState\.mjs'/);
  assert.match(controllerSource, /useMainLayoutControllerDerivedState\(/);
  assert.doesNotMatch(controllerSource, /buildMainLayoutDerivedVoiceState\(/);
  assert.doesNotMatch(controllerSource, /buildMainLayoutDerivedShellState\(/);
  assert.match(derivedStateSource, /function useMainLayoutControllerDerivedState\(/);
  assert.match(derivedStateSource, /buildMainLayoutDerivedVoiceState\(/);
  assert.match(derivedStateSource, /buildMainLayoutDerivedShellState\(/);
});
