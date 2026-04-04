import test from 'node:test';
import assert from 'node:assert/strict';

import {
  finalizeCreatedAccountProfile,
  resolveSessionPubkey,
  shouldPublishProfileDraft,
  syncSessionNostrProfile,
  trimProfileDraft,
  validateProfileDraft,
} from '../../../client/src/features/auth/sessionProfileFlow.mjs';

test('resolveSessionPubkey returns null for invalid npub values', () => {
  assert.equal(resolveSessionPubkey('not-an-npub'), null);
});

test('trimProfileDraft normalizes and truncates publishable profile fields', () => {
  const profile = trimProfileDraft({
    name: `  ${'A'.repeat(60)}  `,
    about: ` ${'B'.repeat(300)} `,
    picture: ' https://cdn.guild.test/pfp.png ',
    banner: ' https://cdn.guild.test/banner.png ',
    lud16: ' builder@getalby.com ',
  });

  assert.deepEqual(profile, {
    name: 'A'.repeat(50),
    about: 'B'.repeat(250),
    picture: 'https://cdn.guild.test/pfp.png',
    banner: 'https://cdn.guild.test/banner.png',
    lud16: 'builder@getalby.com',
  });
});

test('shouldPublishProfileDraft only returns true when there is real profile content', () => {
  assert.equal(shouldPublishProfileDraft(null, null), false);
  assert.equal(shouldPublishProfileDraft({
    name: '',
    about: '',
    picture: '',
    banner: '',
    lud16: '',
  }, null), false);
  assert.equal(shouldPublishProfileDraft({
    name: '',
    about: '',
    picture: '',
    banner: '',
    lud16: 'builder@getalby.com',
  }, null), true);
});

test('validateProfileDraft rejects non-http profile pictures', () => {
  assert.throws(() => validateProfileDraft({
    picture: 'nostr:image-id',
  }), /Profile picture must be an http\(s\) URL/);
});

test('syncSessionNostrProfile returns a server sync patch from relay profile data', async () => {
  const calls = [];
  const result = await syncSessionNostrProfile({
    user: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
      profilePicture: null,
      token: 'session-token',
    },
    loadProfile: async (pubkey) => {
      calls.push(['loadProfile', pubkey]);
      return {
        name: ' Builder Wolf ',
        picture: ' https://cdn.guild.test/pfp.png ',
        lud16: ' builder@getalby.com ',
      };
    },
    apiRequest: async (path, options) => {
      calls.push(['apiRequest', path, JSON.parse(options.body)]);
      return {
        username: 'Builder Wolf',
        avatarColor: '#55FF55',
        npub: null,
        profilePicture: 'https://cdn.guild.test/pfp.png',
      };
    },
  });

  assert.equal(calls[0][0], 'loadProfile');
  assert.deepEqual(calls[1], ['apiRequest', '/api/users/me/nostr-profile', {
    displayName: 'Builder Wolf',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    lud16: 'builder@getalby.com',
  }]);
  assert.deepEqual(result, {
    profile: {
      name: ' Builder Wolf ',
      picture: ' https://cdn.guild.test/pfp.png ',
      lud16: ' builder@getalby.com ',
    },
    syncedUser: {
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: null,
      profilePicture: 'https://cdn.guild.test/pfp.png',
    },
    syncedPatch: {
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
      profilePicture: 'https://cdn.guild.test/pfp.png',
    },
  });
});

test('finalizeCreatedAccountProfile publishes, syncs, and persists updated auth state', async () => {
  const calls = [];
  const result = await finalizeCreatedAccountProfile({
    authData: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      npub: 'npub1builder',
      profilePicture: null,
      token: 'session-token',
    },
    profile: {
      name: ' Builder Wolf ',
      about: '  Hello guild ',
      picture: '',
      banner: '',
      lud16: ' builder@getalby.com ',
    },
    profileImageFile: { name: 'pfp.png' },
    uploadImage: async (file) => {
      calls.push(['uploadImage', file]);
      return 'https://cdn.guild.test/pfp.png';
    },
    publishProfile: async (profile) => {
      calls.push(['publishProfile', profile]);
      return { ok: true };
    },
    apiRequest: async (path, options) => {
      calls.push(['apiRequest', path, JSON.parse(options.body)]);
      return {
        username: 'Builder Wolf',
        avatarColor: '#55FF55',
        npub: null,
        profilePicture: null,
      };
    },
    persistAuth: (authData) => {
      calls.push(['persistAuth', authData]);
    },
  });

  assert.deepEqual(calls, [
    ['uploadImage', { name: 'pfp.png' }],
    ['publishProfile', {
      name: 'Builder Wolf',
      about: 'Hello guild',
      picture: 'https://cdn.guild.test/pfp.png',
      banner: '',
      lud16: 'builder@getalby.com',
    }],
    ['apiRequest', '/api/users/me/nostr-profile', {
      displayName: 'Builder Wolf',
      profilePicture: 'https://cdn.guild.test/pfp.png',
      lud16: 'builder@getalby.com',
    }],
    ['persistAuth', {
      userId: 'user-1',
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: 'npub1builder',
      profilePicture: 'https://cdn.guild.test/pfp.png',
      token: 'session-token',
    }],
  ]);

  assert.deepEqual(result, {
    authData: {
      userId: 'user-1',
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: 'npub1builder',
      profilePicture: 'https://cdn.guild.test/pfp.png',
      token: 'session-token',
    },
    profile: {
      name: 'Builder Wolf',
      about: 'Hello guild',
      picture: 'https://cdn.guild.test/pfp.png',
      banner: '',
      lud16: 'builder@getalby.com',
    },
  });
});
