import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildIdentityRecordAad,
  buildSessionAad,
  collectExistingSessions,
  decryptIdentityKeyBytes,
  deserializeLocalIdentityKeyPair,
  deserializeSessionRecord,
  encryptIdentityKeyBytes,
  normalizeSignalAddress,
  serializeLocalIdentityKeyPair,
  serializeSessionRecord,
} = require('../../../client/electron/crypto/signalStoreSessionIdentityStorage.js');

class FakeRecord {
  constructor(payload) {
    this.payload = Buffer.from(payload);
  }

  serialize() {
    return this.payload;
  }

  static deserialize(data) {
    return new FakeRecord(data);
  }
}

class FakeIdentityKeyPair {
  constructor(payload) {
    this.payload = Buffer.from(payload);
    this.privateKey = `${this.payload.toString('utf8')}:private`;
  }

  serialize() {
    return this.payload;
  }

  static deserialize(data) {
    return new FakeIdentityKeyPair(data);
  }
}

test('signal store session identity storage keeps session aad and normalization stable', () => {
  const address = { toString: () => 'user.7:2' };

  assert.equal(normalizeSignalAddress(address), 'user.7:2');
  assert.equal(buildSessionAad(address), 'session:user.7:2');
  assert.equal(buildIdentityRecordAad(address), 'identity:user.7:2');
});

test('signal store session identity storage round-trips session and local identity records', () => {
  const masterKey = crypto.randomBytes(32);
  const record = new FakeRecord('session-payload');
  const identityPair = new FakeIdentityKeyPair('identity-payload');

  const storedSession = serializeSessionRecord(masterKey, 'user.7:2', record);
  const restoredSession = deserializeSessionRecord(
    masterKey,
    storedSession,
    'user.7:2',
    FakeRecord
  );
  const storedIdentity = serializeLocalIdentityKeyPair(masterKey, identityPair);
  const restoredIdentity = deserializeLocalIdentityKeyPair(
    masterKey,
    storedIdentity,
    FakeIdentityKeyPair
  );

  assert.deepEqual(restoredSession.payload, Buffer.from('session-payload'));
  assert.deepEqual(restoredIdentity.payload, Buffer.from('identity-payload'));
  assert.equal(restoredIdentity.privateKey, 'identity-payload:private');
});

test('signal store session identity storage round-trips encrypted identity key bytes and collects existing sessions', async () => {
  const masterKey = crypto.randomBytes(32);
  const encryptedKey = encryptIdentityKeyBytes(masterKey, Buffer.from('public-key'), 'user.9:1');
  const seen = [];

  const sessions = await collectExistingSessions(
    [{ toString: () => 'a' }, { toString: () => 'b' }, { toString: () => 'c' }],
    async (address) => {
      const id = address.toString();
      seen.push(id);
      return id === 'b' ? null : `${id}:session`;
    }
  );

  assert.deepEqual(decryptIdentityKeyBytes(masterKey, encryptedKey, 'user.9:1'), Buffer.from('public-key'));
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(sessions, ['a:session', 'c:session']);
});
