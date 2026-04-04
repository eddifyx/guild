import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildKyberPreKeyAad,
  buildPreKeyAad,
  buildSignedPreKeyAad,
  buildSenderKeyAad,
  buildSenderKeyStorageKey,
  countUnusedMapEntries,
  deserializeSenderKeyRecord,
  deserializeKyberPreKeyRecord,
  deserializePreKeyRecord,
  deserializeSignedPreKeyRecord,
  deserializeStoredRecord,
  getMapMaxKeyId,
  getSortedMapKeyIds,
  getSortedUnusedMapKeyIds,
  isSenderKeyStorageKeyForDistribution,
  serializeSenderKeyRecord,
  serializeKyberPreKeyRecord,
  serializePreKeyRecord,
  serializeSignedPreKeyRecord,
  serializeStoredRecord,
} = require('../../../client/electron/crypto/signalStoreKeyPersistence.js');

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

test('signal store key persistence helpers round-trip encrypted serialized records', () => {
  const masterKey = crypto.randomBytes(32);
  const record = new FakeRecord('secret-record');

  const stored = serializeStoredRecord(masterKey, record, 'test:aad');
  const restored = deserializeStoredRecord(masterKey, stored, 'test:aad', FakeRecord);

  assert.equal(Buffer.isBuffer(stored), true);
  assert.deepEqual(restored.payload, Buffer.from('secret-record'));
});

test('signal store key persistence helpers keep sender-key indexing stable', () => {
  assert.equal(buildPreKeyAad(7), 'prekey:7');
  assert.equal(buildSignedPreKeyAad(9), 'spk:9');
  assert.equal(buildKyberPreKeyAad(11), 'kyber:11');
  assert.equal(buildSenderKeyAad('user.1', 'room-7'), 'sk:user.1:room-7');
  assert.equal(buildSenderKeyStorageKey('user.1', 'room-7'), 'user.1::room-7');
  assert.equal(isSenderKeyStorageKeyForDistribution('user.1::room-7', 'room-7'), true);
  assert.equal(isSenderKeyStorageKeyForDistribution('user.1::room-8', 'room-7'), false);
});

test('signal store key persistence helpers keep prekey record wrappers stable', () => {
  const masterKey = crypto.randomBytes(32);
  const record = new FakeRecord('typed-record');

  const preKey = deserializePreKeyRecord(
    masterKey,
    serializePreKeyRecord(masterKey, 3, record),
    3,
    FakeRecord
  );
  const signedPreKey = deserializeSignedPreKeyRecord(
    masterKey,
    serializeSignedPreKeyRecord(masterKey, 4, record),
    4,
    FakeRecord
  );
  const kyberPreKey = deserializeKyberPreKeyRecord(
    masterKey,
    serializeKyberPreKeyRecord(masterKey, 5, record),
    5,
    FakeRecord
  );

  assert.deepEqual(preKey.payload, Buffer.from('typed-record'));
  assert.deepEqual(signedPreKey.payload, Buffer.from('typed-record'));
  assert.deepEqual(kyberPreKey.payload, Buffer.from('typed-record'));
});

test('signal store key persistence helpers keep sender-key record wrappers stable', () => {
  const masterKey = crypto.randomBytes(32);
  const record = new FakeRecord('sender-key-record');

  const senderKey = deserializeSenderKeyRecord(
    masterKey,
    serializeSenderKeyRecord(masterKey, 'user.5', 'room-8', record),
    'user.5',
    'room-8',
    FakeRecord
  );

  assert.deepEqual(senderKey.payload, Buffer.from('sender-key-record'));
});

test('signal store key persistence helpers keep key id and unused-entry calculations stable', () => {
  const keyMap = new Map([
    [7, { used: false }],
    [2, { used: true }],
    [11, { used: false }],
  ]);

  assert.equal(getMapMaxKeyId(keyMap), 11);
  assert.deepEqual(getSortedMapKeyIds(keyMap), [2, 7, 11]);
  assert.equal(countUnusedMapEntries(keyMap), 2);
  assert.deepEqual(getSortedUnusedMapKeyIds(keyMap), [7, 11]);
});
