import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller result actions delegate search, request, and invite handlers to dedicated owners', async () => {
  const resultActionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerResultActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(resultActionsSource, /function useFollowingModalControllerResultActions\(/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerSearchActions\.mjs'/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerRequestActions\.mjs'/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerInviteActions\.mjs'/);
  assert.match(resultActionsSource, /useFollowingModalControllerSearchActions\(/);
  assert.match(resultActionsSource, /useFollowingModalControllerRequestActions\(/);
  assert.match(resultActionsSource, /useFollowingModalControllerInviteActions\(/);
  assert.doesNotMatch(resultActionsSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(resultActionsSource, /createFollowingModalCopyInviteAction\(/);
  assert.doesNotMatch(resultActionsSource, /openFollowingModalPrimalProfile\(/);
});
