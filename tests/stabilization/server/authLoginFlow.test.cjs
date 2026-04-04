const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addUserToJoinedGuildRooms,
  consumeValidatedLoginChallenge,
  createSessionToken,
  issueLoginChallenge,
  resolveOrCreateNostrUser,
  resolveVerifiedLoginProof,
} = require('../../../server/src/domain/auth/nostrLoginFlow');

test('issueLoginChallenge enforces the pending challenge limit', () => {
  const result = issueLoginChallenge({
    challenges: new Map([['a', {}]]),
    maxChallenges: 1,
    ttlMs: 1000,
    randomBytes: () => Buffer.from('deadbeef', 'hex'),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 429,
    error: 'Too many pending challenges. Try again later.',
  });
});

test('resolveVerifiedLoginProof validates signed-event login proofs', () => {
  const signedEvent = {
    pubkey: 'pubkey-1',
    tags: [['challenge', 'challenge-1']],
  };

  const result = resolveVerifiedLoginProof({
    body: { signedEvent },
    verifyNostrEvent: () => true,
    isAcceptedLoginProofEvent: () => true,
    decryptNip04: () => {
      throw new Error('unused');
    },
  });

  assert.deepEqual(result, {
    ok: true,
    verifiedPubkey: 'pubkey-1',
    challenge: 'challenge-1',
    signedEvent,
  });
});

test('consumeValidatedLoginChallenge deletes a one-time challenge before timestamp rejection', () => {
  const challenges = new Map([['challenge-1', { expiresAt: Date.now() + 5000 }]]);

  const result = consumeValidatedLoginChallenge({
    challenges,
    challenge: 'challenge-1',
    signedEvent: { created_at: 1 },
    validateLoginChallenge: () => ({ ok: true }),
    validateLoginProofTimestamp: () => ({
      ok: false,
      status: 401,
      error: 'Event timestamp too far from current time',
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Event timestamp too far from current time',
  });
  assert.equal(challenges.has('challenge-1'), false);
});

test('resolveOrCreateNostrUser creates a new row and falls back on uniqueness races', () => {
  let existingUser = null;
  const createUserWithNpub = {
    run() {
      throw new Error('UNIQUE constraint failed: users.npub');
    },
  };

  const result = resolveOrCreateNostrUser({
    npub: 'npub-1',
    displayName: 'Builder',
    lud16: 'builder@guild.test',
    profilePicture: 'https://cdn.guild.test/pfp.png',
    getUserByNpub: {
      get() {
        return existingUser || {
          id: 'user-1',
          username: 'Builder',
          avatar_color: '#40FF40',
          npub: 'npub-1',
          lud16: 'builder@guild.test',
          profile_picture: 'https://cdn.guild.test/pfp.png',
        };
      },
    },
    createUserWithNpub,
    updateUserLud16: { run() {} },
    updateUserProfilePicture: { run() {} },
    buildNewUserRecord: ({ id, npub, displayName, lud16, profilePicture }) => ({
      id,
      username: displayName,
      avatarColor: '#40FF40',
      npub,
      lud16,
      profilePicture,
    }),
    resolveExistingUserProfileUpdates: () => ({}),
    hashColor: () => '#40FF40',
    createId: () => 'user-1',
  });

  assert.deepEqual(result, {
    id: 'user-1',
    username: 'Builder',
    avatar_color: '#40FF40',
    npub: 'npub-1',
    lud16: 'builder@guild.test',
    profile_picture: 'https://cdn.guild.test/pfp.png',
  });
});

test('resolveOrCreateNostrUser updates existing persisted profile fields when they change', () => {
  const calls = [];
  const user = {
    id: 'user-1',
    lud16: 'old@guild.test',
    profile_picture: 'https://cdn.guild.test/old.png',
  };

  const result = resolveOrCreateNostrUser({
    npub: 'npub-1',
    lud16: 'new@guild.test',
    profilePicture: 'https://cdn.guild.test/new.png',
    getUserByNpub: { get: () => user },
    createUserWithNpub: { run() {} },
    updateUserLud16: { run: (...args) => calls.push(['lud16', ...args]) },
    updateUserProfilePicture: { run: (...args) => calls.push(['profilePicture', ...args]) },
    buildNewUserRecord: () => {
      throw new Error('unused');
    },
    resolveExistingUserProfileUpdates: () => ({
      lud16: 'new@guild.test',
      profilePicture: 'https://cdn.guild.test/new.png',
    }),
    hashColor: () => '#40FF40',
    createId: () => 'user-1',
  });

  assert.equal(result, user);
  assert.deepEqual(calls, [
    ['lud16', 'new@guild.test', 'user-1'],
    ['profilePicture', 'https://cdn.guild.test/new.png', 'user-1'],
  ]);
  assert.equal(user.lud16, 'new@guild.test');
  assert.equal(user.profile_picture, 'https://cdn.guild.test/new.png');
});

test('addUserToJoinedGuildRooms fans out room joins across all guild memberships', () => {
  const calls = [];
  addUserToJoinedGuildRooms({
    userId: 'user-1',
    getUserGuilds: {
      all: () => [{ id: 'guild-1' }, { id: 'guild-2' }],
    },
    addUserToGuildRooms: (guildId, userId) => calls.push([guildId, userId]),
  });

  assert.deepEqual(calls, [
    ['guild-1', 'user-1'],
    ['guild-2', 'user-1'],
  ]);
});

test('createSessionToken stores only the hashed token', () => {
  const calls = [];
  const token = createSessionToken({
    userId: 'user-1',
    createSession: {
      run: (...args) => calls.push(args),
    },
    hashToken: (value) => `hashed:${value}`,
    randomBytes: () => Buffer.from('ab'.repeat(32), 'hex'),
  });

  assert.equal(token, 'ab'.repeat(32));
  assert.deepEqual(calls, [[`hashed:${'ab'.repeat(32)}`, 'user-1']]);
});
