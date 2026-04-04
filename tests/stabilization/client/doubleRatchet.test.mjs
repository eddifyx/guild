import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cloneSessionState,
  initializeSessionAsAlice,
  initializeSessionAsBob,
  ratchetDecrypt,
  ratchetEncrypt,
} from '../../../client/src/crypto/doubleRatchet.js';
import { generateX25519KeyPair } from '../../../client/src/crypto/primitives.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createSharedSecret(seed = 7) {
  return new Uint8Array(Array.from({ length: 32 }, (_, index) => (seed + index) % 256));
}

function createAliceBobSessions(seed = 7) {
  const sharedSecret = createSharedSecret(seed);
  const bobSignedPreKeyPair = generateX25519KeyPair();
  const aliceState = initializeSessionAsAlice(sharedSecret, bobSignedPreKeyPair.publicKey);
  const bobState = initializeSessionAsBob(sharedSecret, bobSignedPreKeyPair);
  return { aliceState, bobState };
}

test('double ratchet supports first-message decrypt and reverse-direction reply', () => {
  const { aliceState, bobState } = createAliceBobSessions(11);

  const firstPlaintext = encoder.encode('hello from alice');
  const firstMessage = ratchetEncrypt(aliceState, firstPlaintext, 'alice', 'bob');
  const firstDecryption = ratchetDecrypt(
    bobState,
    firstMessage.header,
    firstMessage.ciphertext,
    firstMessage.nonce,
    'alice',
    'bob',
  );

  assert.equal(decoder.decode(firstDecryption.plaintext), 'hello from alice');
  assert.equal(bobState.CKr !== null, true);
  assert.equal(bobState.CKs !== null, true);
  assert.equal(bobState.Nr, 1);

  const replyPlaintext = encoder.encode('hello back from bob');
  const replyMessage = ratchetEncrypt(bobState, replyPlaintext, 'bob', 'alice');
  const replyDecryption = ratchetDecrypt(
    aliceState,
    replyMessage.header,
    replyMessage.ciphertext,
    replyMessage.nonce,
    'bob',
    'alice',
  );

  assert.equal(decoder.decode(replyDecryption.plaintext), 'hello back from bob');
  assert.equal(aliceState.CKr !== null, true);
  assert.equal(aliceState.CKs !== null, true);
  assert.equal(aliceState.Nr, 1);
});

test('double ratchet preserves out-of-order messages through skipped-key recovery', () => {
  const { aliceState, bobState } = createAliceBobSessions(21);

  const firstMessage = ratchetEncrypt(aliceState, encoder.encode('first'), 'alice', 'bob');
  const secondMessage = ratchetEncrypt(aliceState, encoder.encode('second'), 'alice', 'bob');

  const secondDecryption = ratchetDecrypt(
    bobState,
    secondMessage.header,
    secondMessage.ciphertext,
    secondMessage.nonce,
    'alice',
    'bob',
  );
  assert.equal(decoder.decode(secondDecryption.plaintext), 'second');

  const skippedKeysAfterSecond = Object.keys(bobState.MKSKIPPED);
  assert.equal(skippedKeysAfterSecond.length, 1);

  const firstDecryption = ratchetDecrypt(
    bobState,
    firstMessage.header,
    firstMessage.ciphertext,
    firstMessage.nonce,
    'alice',
    'bob',
  );
  assert.equal(decoder.decode(firstDecryption.plaintext), 'first');
  assert.equal(Object.keys(bobState.MKSKIPPED).length, 0);
});

test('double ratchet rejects invalid header counters before decryption', () => {
  const { bobState } = createAliceBobSessions(31);
  const invalidHeader = {
    dh: 'invalid',
    pn: Number.MAX_SAFE_INTEGER,
    n: Number.MAX_SAFE_INTEGER,
  };

  assert.throws(() => {
    ratchetDecrypt(
      bobState,
      invalidHeader,
      new Uint8Array([1, 2, 3]),
      new Uint8Array(12),
      'alice',
      'bob',
    );
  }, /non-negative integers within safe range/);
});

test('double ratchet leaves session state unchanged on authentication failure', () => {
  const { aliceState, bobState } = createAliceBobSessions(41);
  const message = ratchetEncrypt(aliceState, encoder.encode('do not mutate state'), 'alice', 'bob');

  const bobStateBefore = cloneSessionState(bobState);
  const tamperedCiphertext = new Uint8Array(message.ciphertext);
  tamperedCiphertext[0] ^= 0xff;

  assert.throws(() => {
    ratchetDecrypt(
      bobState,
      message.header,
      tamperedCiphertext,
      message.nonce,
      'alice',
      'bob',
    );
  });

  assert.deepEqual(bobState, bobStateBefore);
});
