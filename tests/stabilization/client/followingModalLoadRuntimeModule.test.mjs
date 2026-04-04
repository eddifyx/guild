import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal load runtime owns contact, request, and sent-request loaders', async () => {
  const loadRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalLoadRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(loadRuntimeSource, /function createFollowingModalLoadFriendsAction\(/);
  assert.match(loadRuntimeSource, /function createFollowingModalLoadRequestsAction\(/);
  assert.match(loadRuntimeSource, /function createFollowingModalLoadSentRequestsAction\(/);
  assert.match(loadRuntimeSource, /applyFollowingModalProfile/);
});
