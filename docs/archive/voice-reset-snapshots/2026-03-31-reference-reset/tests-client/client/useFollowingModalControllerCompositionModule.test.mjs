import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller composition owns view-state and action orchestration', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerComposition.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useFollowingModalControllerComposition\(/);
  assert.match(compositionSource, /useFollowingModalControllerViewState\(/);
  assert.match(compositionSource, /useFollowingModalControllerActions\(/);
});
