import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller runtime delegates load, socket, and search ownership to dedicated modules', async () => {
  const controllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const loadRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalLoadRuntime.mjs', import.meta.url),
    'utf8'
  );
  const socketRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalSocketRuntime.mjs', import.meta.url),
    'utf8'
  );
  const searchRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalSearchRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerRuntimeSource, /from '\.\/followingModalLoadRuntime\.mjs'/);
  assert.match(controllerRuntimeSource, /from '\.\/followingModalSocketRuntime\.mjs'/);
  assert.match(controllerRuntimeSource, /from '\.\/followingModalSearchRuntime\.mjs'/);
  assert.doesNotMatch(controllerRuntimeSource, /function createFollowingModalLoadFriendsAction\(/);
  assert.doesNotMatch(controllerRuntimeSource, /function bindFollowingModalSocketRuntime\(/);
  assert.doesNotMatch(controllerRuntimeSource, /function startFollowingModalSearchRuntime\(/);

  assert.match(loadRuntimeSource, /function createFollowingModalLoadFriendsAction\(/);
  assert.match(socketRuntimeSource, /function bindFollowingModalSocketRuntime\(/);
  assert.match(searchRuntimeSource, /function startFollowingModalSearchRuntime\(/);
});
