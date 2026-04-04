import test from 'node:test';
import assert from 'node:assert/strict';

import { generateX25519KeyPair } from '../../../client/src/crypto/primitives.js';
import {
  initializeRatchetSessionAsAlice,
  initializeRatchetSessionAsBob,
} from '../../../client/src/features/crypto/doubleRatchetSessionInit.mjs';

function createSharedSecret(seed = 5) {
  return new Uint8Array(Array.from({ length: 32 }, (_, index) => (seed + index) % 256));
}

test('double ratchet session init builds Alice state with a sending chain and remote dh key', () => {
  const sharedSecret = createSharedSecret(13);
  const bobSignedPreKeyPair = generateX25519KeyPair();

  const aliceState = initializeRatchetSessionAsAlice(sharedSecret, bobSignedPreKeyPair.publicKey);

  assert.equal(typeof aliceState.DHs.privateKey, 'string');
  assert.equal(typeof aliceState.DHs.publicKey, 'string');
  assert.equal(aliceState.DHr, Buffer.from(bobSignedPreKeyPair.publicKey).toString('base64'));
  assert.equal(typeof aliceState.RK, 'string');
  assert.equal(typeof aliceState.CKs, 'string');
  assert.equal(aliceState.CKr, null);
  assert.equal(aliceState.Ns, 0);
  assert.equal(aliceState.Nr, 0);
  assert.equal(aliceState.PN, 0);
  assert.deepEqual(aliceState.MKSKIPPED, {});
});

test('double ratchet session init builds Bob state with root key only until first receive', () => {
  const sharedSecret = createSharedSecret(29);
  const signedPreKeyPair = generateX25519KeyPair();

  const bobState = initializeRatchetSessionAsBob(sharedSecret, signedPreKeyPair);

  assert.equal(bobState.DHr, null);
  assert.equal(bobState.CKs, null);
  assert.equal(bobState.CKr, null);
  assert.equal(typeof bobState.RK, 'string');
  assert.equal(typeof bobState.DHs.privateKey, 'string');
  assert.equal(typeof bobState.DHs.publicKey, 'string');
  assert.equal(bobState.Ns, 0);
  assert.equal(bobState.Nr, 0);
  assert.equal(bobState.PN, 0);
  assert.deepEqual(bobState.MKSKIPPED, {});
});
