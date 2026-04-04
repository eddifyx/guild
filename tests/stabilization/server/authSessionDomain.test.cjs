const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAuthResponsePayload,
  buildNewUserRecord,
  isAcceptedLoginProofEvent,
  resolveExistingUserProfileUpdates,
  sanitizeProfilePictureUrl,
  validateLoginChallenge,
  validateLoginProofTimestamp,
} = require('../../../server/src/domain/auth/nostrSession');

test('sanitizeProfilePictureUrl only accepts http and https urls', () => {
  assert.equal(sanitizeProfilePictureUrl('https://cdn.guild.test/avatar.png'), 'https://cdn.guild.test/avatar.png');
  assert.equal(sanitizeProfilePictureUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeProfilePictureUrl(''), null);
});

test('isAcceptedLoginProofEvent allows nip-42 and compatibility login proofs only', () => {
  assert.equal(isAcceptedLoginProofEvent({
    kind: 22242,
    content: '',
    tags: [['challenge', 'abc']],
  }), true);

  assert.equal(isAcceptedLoginProofEvent({
    kind: 1,
    content: '/guild login',
    tags: [['client', '/guild']],
  }), true);

  assert.equal(isAcceptedLoginProofEvent({
    kind: 1,
    content: 'wrong',
    tags: [['client', '/guild']],
  }), false);
});

test('validateLoginChallenge rejects missing and expired challenges', () => {
  assert.deepEqual(validateLoginChallenge({ storedChallenge: null }), {
    ok: false,
    status: 401,
    error: 'Unknown or expired challenge',
  });

  assert.deepEqual(validateLoginChallenge({
    storedChallenge: { expiresAt: 1000 },
    now: 1001,
  }), {
    ok: false,
    status: 401,
    error: 'Challenge expired',
  });
});

test('validateLoginProofTimestamp rejects overly stale login proofs', () => {
  assert.deepEqual(validateLoginProofTimestamp({ created_at: 500 }, 900), {
    ok: false,
    status: 401,
    error: 'Event timestamp too far from current time',
  });
});

test('buildNewUserRecord derives stable defaults for new users', () => {
  const user = buildNewUserRecord({
    id: 'user-1',
    npub: 'npub1example1234567890',
    displayName: '  Builder Wolf  ',
    lud16: ' builder@guild.test ',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    hashColor: () => '#40FF40',
  });

  assert.deepEqual(user, {
    id: 'user-1',
    username: 'Builder Wolf',
    avatarColor: '#40FF40',
    npub: 'npub1example1234567890',
    lud16: 'builder@guild.test',
    profilePicture: 'https://cdn.guild.test/pfp.png',
  });
});

test('resolveExistingUserProfileUpdates only returns changed persisted fields', () => {
  const updates = resolveExistingUserProfileUpdates({
    user: {
      lud16: 'old@guild.test',
      profile_picture: 'https://cdn.guild.test/old.png',
    },
    lud16: 'new@guild.test',
    profilePicture: 'https://cdn.guild.test/new.png',
  });

  assert.deepEqual(updates, {
    lud16: 'new@guild.test',
    profilePicture: 'https://cdn.guild.test/new.png',
  });
});

test('buildAuthResponsePayload shapes the canonical login response', () => {
  const payload = buildAuthResponsePayload({
    user: {
      id: 'user-1',
      username: 'Builder',
      avatar_color: '#40FF40',
      npub: 'npub1builder',
      lud16: null,
      profile_picture: 'https://cdn.guild.test/pfp.png',
    },
    token: 'session-token',
  });

  assert.deepEqual(payload, {
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    lud16: null,
    profilePicture: 'https://cdn.guild.test/pfp.png',
    token: 'session-token',
  });
});
