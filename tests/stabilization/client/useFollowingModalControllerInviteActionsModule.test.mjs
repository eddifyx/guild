import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal invite actions own invite, dm, profile, and action-state handlers', async () => {
  const inviteActionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerInviteActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(inviteActionsSource, /function useFollowingModalControllerInviteActions\(/);
  assert.match(inviteActionsSource, /createFollowingModalCopyNpubAction\(/);
  assert.match(inviteActionsSource, /createFollowingModalCopyInviteAction\(/);
  assert.match(inviteActionsSource, /createFollowingModalSendNostrDmAction\(/);
  assert.match(inviteActionsSource, /openFollowingModalPrimalProfile\(/);
  assert.match(inviteActionsSource, /getFollowingModalResultActionState\(/);
  assert.match(inviteActionsSource, /toggleFollowingModalInviteMenu\(/);
  assert.doesNotMatch(inviteActionsSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(inviteActionsSource, /createFollowingModalRequestDecisionAction\(/);
  assert.doesNotMatch(inviteActionsSource, /createFollowingModalRemoveFriendAction\(/);
});
