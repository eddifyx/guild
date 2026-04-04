import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuthenticatedSessionUser,
  buildCreatedAccountSessionUser,
  buildSyncedSessionPatch,
  mergeSessionUser,
  normalizeSessionUser,
} from '../../../client/src/features/auth/sessionUserState.mjs';

test('normalizeSessionUser keeps the recoverable auth shape stable', () => {
  assert.deepEqual(normalizeSessionUser({
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    token: 'session-token',
    ignored: true,
  }), {
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    token: 'session-token',
  });
});

test('buildAuthenticatedSessionUser maps server login payloads into session user state', () => {
  assert.deepEqual(buildAuthenticatedSessionUser({
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: null,
    token: 'session-token',
  }), {
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: null,
    token: 'session-token',
  });
});

test('mergeSessionUser preserves the normalized session shape after updates', () => {
  const merged = mergeSessionUser({
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: null,
    token: 'session-token',
  }, {
    username: 'Builder Wolf',
    profilePicture: 'https://cdn.guild.test/new.png',
  });

  assert.deepEqual(merged, {
    userId: 'user-1',
    username: 'Builder Wolf',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    profilePicture: 'https://cdn.guild.test/new.png',
    token: 'session-token',
  });
});

test('buildSyncedSessionPatch keeps current npub when the sync response omits it', () => {
  assert.deepEqual(buildSyncedSessionPatch({
    currentUser: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      npub: 'npub1builder',
      profilePicture: null,
      token: 'session-token',
    },
    syncedUser: {
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: null,
      profilePicture: 'https://cdn.guild.test/new.png',
    },
  }), {
    username: 'Builder Wolf',
    avatarColor: '#55FF55',
    npub: 'npub1builder',
    profilePicture: 'https://cdn.guild.test/new.png',
  });
});

test('buildCreatedAccountSessionUser folds post-create profile updates into recoverable auth', () => {
  const nextUser = buildCreatedAccountSessionUser({
    authData: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      npub: 'npub1builder',
      profilePicture: null,
      token: 'session-token',
    },
    syncedUser: {
      username: 'Builder Wolf',
      avatarColor: '#55FF55',
      npub: 'npub1builder-updated',
      profilePicture: null,
    },
    nextProfilePicture: 'https://cdn.guild.test/pfp.png',
  });

  assert.deepEqual(nextUser, {
    userId: 'user-1',
    username: 'Builder Wolf',
    avatarColor: '#55FF55',
    npub: 'npub1builder-updated',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    token: 'session-token',
  });
});
