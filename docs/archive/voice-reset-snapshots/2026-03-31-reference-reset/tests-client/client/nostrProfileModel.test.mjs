import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNostrProfileViewState } from '../../../client/src/features/social/nostrProfileModel.mjs';

test('nostr profile model prefers fetched profile fields and derives guild/status state', () => {
  const state = buildNostrProfileViewState({
    user: {
      userId: 'user-1',
      username: 'edd',
      npub: 'npub123456789012345678901234567890',
      profilePicture: 'fallback.png',
    },
    profile: {
      name: 'Eddify',
      picture: 'profile.png',
      about: 'building guild',
    },
    onlineUsers: [{ userId: 'user-1', customStatus: 'Refactoring' }],
    currentGuildData: { name: 'Byzantine', member_count: 12 },
  });

  assert.equal(state.displayName, 'Eddify');
  assert.equal(state.picture, 'profile.png');
  assert.equal(state.about, 'building guild');
  assert.equal(state.myStatus, 'Refactoring');
  assert.equal(state.guildName, 'Byzantine');
  assert.equal(state.guildMemberCount, 12);
  assert.equal(state.guildInitial, 'B');
  assert.match(state.npubLabel, /^npub1234567890123456\.\.\./);
});

test('nostr profile model falls back cleanly to auth state when relay profile is unavailable', () => {
  const state = buildNostrProfileViewState({
    user: {
      userId: 'user-1',
      username: 'edd',
      npub: 'npub1fallback000000000000000000000',
      profilePicture: 'fallback.png',
    },
    profile: null,
    onlineUsers: [],
    currentGuildData: null,
  });

  assert.equal(state.displayName, 'edd');
  assert.equal(state.picture, 'fallback.png');
  assert.equal(state.about, '');
  assert.equal(state.myStatus, '');
  assert.equal(state.guildName, 'Guild');
  assert.equal(state.guildMemberCount, '—');
  assert.equal(state.guildInitial, 'G');
});

