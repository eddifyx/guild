import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller delegates view-state assembly to a dedicated hook', async () => {
  const runtimeViewSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerRuntimeView.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeViewSource, /from '\.\/useMainLayoutControllerViewState\.mjs'/);
  assert.match(runtimeViewSource, /useMainLayoutControllerViewState\(/);
  assert.doesNotMatch(runtimeViewSource, /buildMainLayoutViewState\(/);
  assert.doesNotMatch(runtimeViewSource, /buildMainLayoutViewInput\(/);
  assert.match(viewStateSource, /function useMainLayoutControllerViewState\(/);
  assert.match(viewStateSource, /buildMainLayoutViewState\(/);
  assert.match(viewStateSource, /buildMainLayoutViewInput\(/);
});
