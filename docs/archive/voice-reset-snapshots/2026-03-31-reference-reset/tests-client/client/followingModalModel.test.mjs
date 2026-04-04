import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFollowingModalFriendRow,
  buildFollowingModalIncomingRequestRow,
  buildFollowingModalSearchResultRow,
  buildFollowingModalSearchViewState,
  buildFollowingModalTabs,
  formatFollowingModalNpub,
  getFollowingModalResultActionState,
  getFollowingModalSearchMessageTone,
} from '../../../client/src/features/social/followingModalModel.mjs';

test('following modal model builds active tabs with counts', () => {
  const tabs = buildFollowingModalTabs({
    activeTab: 'requests',
    contactsCount: 4,
    incomingCount: 2,
  });

  assert.deepEqual(tabs, [
    { key: 'friends', label: 'Friends', count: 4, active: false },
    { key: 'requests', label: 'Requests', count: 2, active: true },
    { key: 'search', label: 'Search', count: 0, active: false },
  ]);
});

test('following modal model formats npubs and derives search message tone', () => {
  assert.equal(formatFollowingModalNpub('npub12345678901234567890', 8, 4), 'npub1234...7890');
  assert.equal(getFollowingModalSearchMessageTone('Invite link copied!'), 'success');
  assert.equal(getFollowingModalSearchMessageTone('Failed to send DM'), 'error');
});

test('following modal model derives search empty and result states', () => {
  assert.deepEqual(
    buildFollowingModalSearchViewState({ query: 'ed', searching: true, searchResults: [] }),
    { mode: 'searching', message: 'Searching...' },
  );
  assert.deepEqual(
    buildFollowingModalSearchViewState({ query: 'ed', searching: false, searchResults: [] }),
    { mode: 'empty', message: 'No users found' },
  );
  assert.deepEqual(
    buildFollowingModalSearchViewState({ query: '', searching: false, searchResults: [] }),
    { mode: 'prompt', message: 'Search for Nostr users by name or paste an npub' },
  );
  assert.deepEqual(
    buildFollowingModalSearchViewState({ query: 'ed', searching: false, searchResults: [{ npub: 'npub1' }] }),
    { mode: 'results', message: '' },
  );
});

test('following modal model derives action states for friends, pending, request, and invite', () => {
  assert.deepEqual(getFollowingModalResultActionState({
    npub: 'npub-friend',
    friendNpubs: new Set(['npub-friend']),
  }), { kind: 'friends' });

  assert.deepEqual(getFollowingModalResultActionState({
    npub: 'npub-pending',
    sentNpubs: new Set(['npub-pending']),
  }), { kind: 'pending' });

  assert.deepEqual(getFollowingModalResultActionState({
    npub: 'npub-guild',
    guildNpubs: new Set(['npub-guild']),
    sendingNpub: 'npub-guild',
  }), { kind: 'request', busy: true });

  assert.deepEqual(getFollowingModalResultActionState({
    npub: 'npub-external',
    sendingDM: true,
    inviteMenuNpub: 'npub-external',
  }), { kind: 'invite', busy: true, open: true });
});

test('following modal model builds friend, request, and search rows', () => {
  const friendRow = buildFollowingModalFriendRow({
    contact: { contact_npub: 'npub1friend000000000000000000', display_name: 'Edd' },
    profile: { picture: 'pic.png' },
    selectedNpub: 'npub1friend000000000000000000',
  });
  assert.equal(friendRow.selected, true);
  assert.equal(friendRow.displayName, 'Edd');
  assert.equal(friendRow.picture, 'pic.png');

  const requestRow = buildFollowingModalIncomingRequestRow({
    id: 'req-1',
    from_username: 'Alice',
    from_npub: 'npub1alice000000000000000000000',
  });
  assert.equal(requestRow.displayName, 'Alice');
  assert.match(requestRow.npubLabel, /npub1alice/);

  const searchRow = buildFollowingModalSearchResultRow({
    npub: 'npub1search000000000000000000000',
    name: '',
  });
  assert.match(searchRow.displayName, /npub1search/);
  assert.match(searchRow.npubLabel, /\.\.\./);
});
