const test = require('node:test');
const assert = require('node:assert/strict');

const { createNostrAuthRuntime } = require('../../../server/src/domain/auth/nostrAuthRuntime');

test('auth runtime issues challenges and cleans expired ones', () => {
  let counter = 0;
  const runtime = createNostrAuthRuntime({
    cryptoModule: {
      randomBytes(size) {
        counter += 1;
        return Buffer.alloc(size, counter);
      },
      createDecipheriv() {
        throw new Error('unused');
      },
    },
    secp256k1: {
      getSharedSecret() {
        throw new Error('unused');
      },
    },
    schnorr: {
      getPublicKey() {
        return Buffer.from('11'.repeat(32), 'hex');
      },
    },
    bytesToHex(buffer) {
      return Buffer.from(buffer).toString('hex');
    },
    issueLoginChallenge: ({ challenges, randomBytes, ttlMs, now }) => {
      const challenge = randomBytes(4).toString('hex');
      challenges.set(challenge, { expiresAt: now + ttlMs });
      return { ok: true, challenge };
    },
    consumeValidatedLoginChallenge() {
      throw new Error('unused');
    },
    challengeTtlMs: 100,
  });

  const challengeResult = runtime.issueChallenge(10);
  assert.deepEqual(challengeResult, { ok: true, challenge: '02020202' });
  assert.equal(runtime.getChallengeCount(), 1);

  runtime.cleanupExpiredChallenges(50);
  assert.equal(runtime.getChallengeCount(), 1);

  runtime.cleanupExpiredChallenges(111);
  assert.equal(runtime.getChallengeCount(), 0);
});

test('auth runtime delegates challenge consumption to the shared domain flow', () => {
  const calls = [];
  const runtime = createNostrAuthRuntime({
    cryptoModule: {
      randomBytes(size) {
        return Buffer.alloc(size, 1);
      },
      createDecipheriv() {
        throw new Error('unused');
      },
    },
    secp256k1: {
      getSharedSecret() {
        throw new Error('unused');
      },
    },
    schnorr: {
      getPublicKey() {
        return Buffer.from('22'.repeat(32), 'hex');
      },
    },
    bytesToHex(buffer) {
      return Buffer.from(buffer).toString('hex');
    },
    issueLoginChallenge: ({ challenges }) => {
      challenges.set('challenge-1', { expiresAt: 1000 });
      return { ok: true, challenge: 'challenge-1' };
    },
    consumeValidatedLoginChallenge: (options) => {
      calls.push(options.challenge);
      return { ok: true };
    },
  });

  runtime.issueChallenge(0);
  const result = runtime.consumeValidatedChallenge({
    challenge: 'challenge-1',
    signedEvent: { created_at: 1 },
    validateLoginChallenge: () => ({ ok: true }),
    validateLoginProofTimestamp: () => ({ ok: true }),
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ['challenge-1']);
});

test('auth runtime decryptor rejects malformed NIP-04 payloads before crypto work', () => {
  const runtime = createNostrAuthRuntime({
    cryptoModule: {
      randomBytes(size) {
        return Buffer.alloc(size, 3);
      },
      createDecipheriv() {
        throw new Error('unused');
      },
    },
    secp256k1: {
      getSharedSecret() {
        throw new Error('unused');
      },
    },
    schnorr: {
      getPublicKey() {
        return Buffer.from('33'.repeat(32), 'hex');
      },
    },
    bytesToHex(buffer) {
      return Buffer.from(buffer).toString('hex');
    },
    issueLoginChallenge: () => ({ ok: true, challenge: 'unused' }),
    consumeValidatedLoginChallenge: () => ({ ok: true }),
  });

  assert.throws(() => runtime.decryptNip04('ciphertext', 'not-a-pubkey'), /Invalid NIP-04 payload/);
  assert.throws(() => runtime.decryptNip04('ciphertext', 'a'.repeat(64)), /Missing NIP-04 IV/);
});
