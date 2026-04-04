import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal request actions own relationship request and removal handlers', async () => {
  const requestActionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerRequestActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(requestActionsSource, /function useFollowingModalControllerRequestActions\(/);
  assert.match(requestActionsSource, /createFollowingModalSendRequestAction\(/);
  assert.match(requestActionsSource, /createFollowingModalRequestDecisionAction\(/);
  assert.match(requestActionsSource, /createFollowingModalRemoveFriendAction\(/);
  assert.match(requestActionsSource, /sendFriendRequest/);
  assert.match(requestActionsSource, /acceptFriendRequest/);
  assert.match(requestActionsSource, /rejectFriendRequest/);
  assert.match(requestActionsSource, /removeContact/);
  assert.doesNotMatch(requestActionsSource, /createFollowingModalCopyInviteAction\(/);
  assert.doesNotMatch(requestActionsSource, /createFollowingModalSendNostrDmAction\(/);
  assert.doesNotMatch(requestActionsSource, /openFollowingModalPrimalProfile\(/);
});
