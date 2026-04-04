import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createKyberPreKeyStoreClass,
  createPreKeyStoreClass,
  createSenderKeyStoreClass,
  createSignedPreKeyStoreClass,
} = require('../../../client/electron/crypto/signalProtocolStoreKeyClassBuilders.js');
const {
  buildSenderKeyStorageKey,
} = require('../../../client/electron/crypto/signalStoreKeyPersistence.js');

test('signal protocol key store builders create prekey and signed-prekey stores with canonical persistence behavior', async () => {
  class PreKeyStoreBase {}
  class SignedPreKeyStoreBase {}
  const PreKeyRecord = {
    deserialize(bytes) {
      return { preKey: Buffer.from(bytes).toString('utf8') };
    },
  };
  const SignedPreKeyRecord = {
    deserialize(bytes) {
      return { signedPreKey: Buffer.from(bytes).toString('utf8') };
    },
  };

  const PreKeyStoreClass = createPreKeyStoreClass({
    PreKeyStoreBase,
    PreKeyRecord,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._records = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    serializeRecord: (_mk, _id, record) => Buffer.from(record.serialize()),
    deserializeRecord: (_mk, record, _id, RecordClass) => RecordClass.deserialize(record),
    saveStoredRecord: (instance, id, blob) => instance._records.set(id, blob),
    readStoredRecord: (instance, id) => instance._records.get(id) ?? null,
    deleteStoredRecord: (instance, id) => instance._records.delete(id),
    getMaxKeyId: (instance) => Math.max(0, ...instance._records.keys()),
    getCount: (instance) => instance._records.size,
    getAllIds: (instance) => [...instance._records.keys()].sort((a, b) => a - b),
  });

  const SignedPreKeyStoreClass = createSignedPreKeyStoreClass({
    SignedPreKeyStoreBase,
    SignedPreKeyRecord,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._records = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    serializeRecord: (_mk, _id, record) => Buffer.from(record.serialize()),
    deserializeRecord: (_mk, record, _id, RecordClass) => RecordClass.deserialize(record),
    saveStoredRecord: (instance, id, blob) => instance._records.set(id, blob),
    readStoredRecord: (instance, id) => instance._records.get(id) ?? null,
    getMaxKeyId: (instance) => Math.max(0, ...instance._records.keys()),
  });

  const preKeyStore = new PreKeyStoreClass(Buffer.alloc(32, 1));
  const signedPreKeyStore = new SignedPreKeyStoreClass(Buffer.alloc(32, 2));

  await preKeyStore.savePreKey(3, { serialize: () => 'pre-3' });
  await preKeyStore.savePreKey(1, { serialize: () => 'pre-1' });
  assert.deepEqual(await preKeyStore.getPreKey(3), { preKey: 'pre-3' });
  assert.equal(preKeyStore.getMaxKeyId(), 3);
  assert.equal(preKeyStore.getCount(), 2);
  assert.deepEqual(preKeyStore.getAllIds(), [1, 3]);
  await preKeyStore.removePreKey(1);
  assert.equal(preKeyStore.getCount(), 1);

  await signedPreKeyStore.saveSignedPreKey(9, { serialize: () => 'spk-9' });
  assert.deepEqual(await signedPreKeyStore.getSignedPreKey(9), { signedPreKey: 'spk-9' });
  assert.equal(signedPreKeyStore.getMaxKeyId(), 9);
});

test('signal protocol key store builders create Kyber and sender-key stores with canonical usage and room cleanup behavior', async () => {
  class KyberPreKeyStoreBase {}
  class SenderKeyStoreBase {}
  const KyberPreKeyRecord = {
    deserialize(bytes) {
      return { kyberPreKey: Buffer.from(bytes).toString('utf8') };
    },
  };
  const SenderKeyRecord = {
    deserialize(bytes) {
      return { senderKey: Buffer.from(bytes).toString('utf8') };
    },
  };

  const KyberStoreClass = createKyberPreKeyStoreClass({
    KyberPreKeyStoreBase,
    KyberPreKeyRecord,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._records = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    serializeRecord: (_mk, _id, record) => Buffer.from(record.serialize()),
    deserializeRecord: (_mk, record, _id, RecordClass) => RecordClass.deserialize(record),
    saveStoredRecord: (instance, id, blob) => instance._records.set(id, { record: blob, used: false }),
    readStoredRecord: (instance, id) => instance._records.get(id)?.record ?? null,
    markStoredRecordUsed(instance, id) {
      const entry = instance._records.get(id);
      if (entry) entry.used = true;
    },
    getMaxKeyId: (instance) => Math.max(0, ...instance._records.keys()),
    getCount: (instance) => [...instance._records.values()].filter((entry) => !entry.used).length,
    getAllIds: (instance) => [...instance._records.entries()].filter(([, entry]) => !entry.used).map(([id]) => id).sort((a, b) => a - b),
  });

  const SenderKeyStoreClass = createSenderKeyStoreClass({
    SenderKeyStoreBase,
    SenderKeyRecord,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._records = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    serializeRecord: (_mk, addr, distributionId, record) => Buffer.from(`${addr}:${distributionId}:${record.serialize()}`),
    deserializeRecord: (_mk, record, _addr, _distributionId, RecordClass) => RecordClass.deserialize(record.subarray(record.lastIndexOf(':') + 1)),
    saveStoredRecord: (instance, addr, distributionId, blob) => instance._records.set(buildSenderKeyStorageKey(addr, distributionId), blob),
    readStoredRecord: (instance, addr, distributionId) => instance._records.get(buildSenderKeyStorageKey(addr, distributionId)) ?? null,
    deleteRoomRecords(instance, distributionId) {
      for (const key of instance._records.keys()) {
        if (key.endsWith(`::${distributionId}`)) {
          instance._records.delete(key);
        }
      }
    },
  });

  const kyberStore = new KyberStoreClass(Buffer.alloc(32, 3));
  await kyberStore.saveKyberPreKey(2, { serialize: () => 'kyber-2' });
  await kyberStore.saveKyberPreKey(5, { serialize: () => 'kyber-5' });
  assert.deepEqual(await kyberStore.getKyberPreKey(2), { kyberPreKey: 'kyber-2' });
  assert.equal(kyberStore.getCount(), 2);
  await kyberStore.markKyberPreKeyUsed(2);
  assert.equal(kyberStore.getCount(), 1);
  assert.deepEqual(kyberStore.getAllIds(), [5]);

  const senderKeyStore = new SenderKeyStoreClass(Buffer.alloc(32, 4));
  await senderKeyStore.saveSenderKey({ toString: () => 'alice.1' }, 'room-1', { serialize: () => 'sender-1' });
  await senderKeyStore.saveSenderKey({ toString: () => 'alice.2' }, 'room-1', { serialize: () => 'sender-2' });
  assert.deepEqual(await senderKeyStore.getSenderKey({ toString: () => 'alice.1' }, 'room-1'), { senderKey: 'sender-1' });
  senderKeyStore.deleteSenderKeysForRoom('room-1');
  assert.equal(await senderKeyStore.getSenderKey({ toString: () => 'alice.1' }, 'room-1'), null);
});
