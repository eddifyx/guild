import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createMemoryProtocolStoreMemberFactories,
  createSQLiteProtocolStoreMemberFactories,
} = require('../../../client/electron/crypto/signalProtocolStoreMemberFactories.js');

class FakeSQLiteStore {
  constructor(db, masterKey) {
    this.db = db;
    this.masterKey = masterKey;
  }
}

class FakeMemoryStore {
  constructor(masterKey) {
    this.masterKey = masterKey;
  }
}

test('signal protocol store member factories build canonical sqlite store constructors', () => {
  const db = { name: 'db' };
  const masterKey = Buffer.alloc(32, 5);
  const factories = createSQLiteProtocolStoreMemberFactories({
    db,
    masterKey,
    SessionStoreClass: FakeSQLiteStore,
    IdentityStoreClass: FakeSQLiteStore,
    PreKeyStoreClass: FakeSQLiteStore,
    SignedPreKeyStoreClass: FakeSQLiteStore,
    KyberPreKeyStoreClass: FakeSQLiteStore,
    SenderKeyStoreClass: FakeSQLiteStore,
    createRoomDistributionMap: ({ db: roomDb }) => ({ roomDb }),
  });

  assert.equal(factories.createSessionStore().db, db);
  assert.equal(factories.createIdentityStore().masterKey, masterKey);
  assert.equal(factories.createSenderKeyStore().db, db);
  assert.deepEqual(factories.createRoomDistribution(), { roomDb: db });
});

test('signal protocol store member factories build canonical memory store constructors', () => {
  const masterKey = Buffer.alloc(32, 9);
  const factories = createMemoryProtocolStoreMemberFactories({
    masterKey,
    SessionStoreClass: FakeMemoryStore,
    IdentityStoreClass: FakeMemoryStore,
    PreKeyStoreClass: FakeMemoryStore,
    SignedPreKeyStoreClass: FakeMemoryStore,
    KyberPreKeyStoreClass: FakeMemoryStore,
    SenderKeyStoreClass: FakeMemoryStore,
    createRoomDistributionMap: () => ({ type: 'memory-room-map' }),
  });

  assert.equal(factories.createSessionStore().masterKey, masterKey);
  assert.equal(factories.createKyberPreKeyStore().masterKey, masterKey);
  assert.deepEqual(factories.createRoomDistribution(), { type: 'memory-room-map' });
});
