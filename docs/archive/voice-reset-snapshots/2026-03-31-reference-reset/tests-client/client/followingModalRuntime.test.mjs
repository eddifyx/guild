import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFollowingModalProfile,
  FOLLOWING_MODAL_INVITE_TEXT,
  getFollowingModalSearchPlan,
  mergeFollowingModalIncomingRequests,
  toggleFollowingModalInviteMenu,
} from '../../../client/src/features/social/followingModalRuntime.mjs';

test('following modal runtime plans idle, npub, and profile searches', () => {
  assert.deepEqual(getFollowingModalSearchPlan('a'), { mode: 'idle', query: 'a', delayMs: 0 });
  assert.deepEqual(getFollowingModalSearchPlan('npub1abc'), { mode: 'npub', query: 'npub1abc', delayMs: 200 });
  assert.deepEqual(getFollowingModalSearchPlan('edd'), { mode: 'profiles', query: 'edd', delayMs: 400 });
});

test('following modal runtime merges incoming requests by id', () => {
  const merged = mergeFollowingModalIncomingRequests(
    [{ id: 'old', from_npub: 'npub1old' }, { id: 'new', from_npub: 'npub1stale' }],
    { id: 'new', from_npub: 'npub1fresh' },
  );

  assert.deepEqual(merged, [
    { id: 'new', from_npub: 'npub1fresh' },
    { id: 'old', from_npub: 'npub1old' },
  ]);
});

test('following modal runtime applies profiles and toggles invite menus', () => {
  assert.deepEqual(
    applyFollowingModalProfile({}, 'npub1abc', { name: 'edd' }),
    { npub1abc: { name: 'edd' } },
  );
  assert.equal(toggleFollowingModalInviteMenu(null, 'npub1abc'), 'npub1abc');
  assert.equal(toggleFollowingModalInviteMenu('npub1abc', 'npub1abc'), null);
  assert.match(FOLLOWING_MODAL_INVITE_TEXT, /guild\.app/);
});
