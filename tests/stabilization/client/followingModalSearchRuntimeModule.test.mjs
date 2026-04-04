import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal search runtime owns query planning and npub search resolution', async () => {
  const searchRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalSearchRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(searchRuntimeSource, /function startFollowingModalSearchRuntime\(/);
  assert.match(searchRuntimeSource, /getFollowingModalSearchPlan/);
  assert.match(searchRuntimeSource, /searchPlan\.mode === 'idle'/);
  assert.match(searchRuntimeSource, /searchPlan\.mode === 'npub'/);
  assert.match(searchRuntimeSource, /searchProfilesFn/);
  assert.match(searchRuntimeSource, /checkNpubsFn/);
});
