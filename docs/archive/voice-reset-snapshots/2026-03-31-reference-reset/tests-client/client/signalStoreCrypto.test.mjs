import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  decryptAtRest,
  encryptAtRest,
} = require('../../../client/electron/crypto/signalStoreCrypto.js');

test('signal store crypto round-trips encrypted blobs with authenticated data', () => {
  const masterKey = crypto.randomBytes(32);
  const plaintext = Buffer.from('secret-payload', 'utf8');

  const encrypted = encryptAtRest(masterKey, plaintext, 'aad:test');
  assert.equal(Buffer.isBuffer(encrypted), true);
  assert.equal(encrypted.length > plaintext.length, true);

  const decrypted = decryptAtRest(masterKey, encrypted, 'aad:test');
  assert.deepEqual(decrypted, plaintext);
});

test('signal store crypto rejects tampered blobs or mismatched authenticated data', () => {
  const masterKey = crypto.randomBytes(32);
  const plaintext = Buffer.from('secret-payload', 'utf8');
  const encrypted = encryptAtRest(masterKey, plaintext, 'aad:test');
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 0x01;

  assert.throws(() => decryptAtRest(masterKey, tampered, 'aad:test'));
  assert.throws(() => decryptAtRest(masterKey, encrypted, 'aad:wrong'));
});
