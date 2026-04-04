import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller delegates form-state derivation to a dedicated view-state hook', async () => {
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(viewStateSource, /function useLoginScreenControllerViewState\(/);
  assert.match(viewStateSource, /buildLoginScreenFormState\(/);
  assert.match(viewStateSource, /useMemo\(\(\) => buildLoginScreenFormState/);
  assert.match(viewStateSource, /isCreateView: view === 'create'/);
});
