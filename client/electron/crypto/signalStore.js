/**
 * /guild — libsignal Protocol Store (SQLite-backed)
 *
 * Implements the 6 abstract store classes required by @signalapp/libsignal-client:
 *   SessionStore, IdentityKeyStore, PreKeyStore, SignedPreKeyStore,
 *   KyberPreKeyStore, SenderKeyStore
 *
 * All records are serialized via libsignal's .serialize() and stored as BLOBs
 * in a local SQLite database (better-sqlite3). BLOBs are encrypted with
 * AES-256-GCM using the app-local Signal master key managed by signalBridge.
 */

const { importLibsignalModule } = require('./runtimeModules');
const { createMemoryProtocolStore } = require('./signalStoreMemory');
const { createCachedAsyncLoader } = require('./signalProtocolStoreClassCache');
const {
  createIdentityKeyStoreClass,
  createSessionStoreClass,
} = require('./signalProtocolStoreClassBuilders');
const {
  createKyberPreKeyStoreClass,
  createPreKeyStoreClass,
  createSenderKeyStoreClass,
  createSignedPreKeyStoreClass,
} = require('./signalProtocolStoreKeyClassBuilders');
const {
  createProtocolStoreWithFallback,
  shouldUseMemoryProtocolStoreFallback,
} = require('./signalProtocolStoreFallback');
const {
  createProtocolStoreClass,
} = require('./signalProtocolStoreAggregate');
const {
  createSQLiteProtocolStoreMemberFactories,
} = require('./signalProtocolStoreMemberFactories');
const {
  deserializeKyberPreKeyRecord,
  deserializePreKeyRecord,
  deserializeSenderKeyRecord,
  deserializeSignedPreKeyRecord,
  buildSenderKeyAad,
  serializeSenderKeyRecord,
  serializeKyberPreKeyRecord,
  serializePreKeyRecord,
  serializeSignedPreKeyRecord,
  serializeStoredRecord,
} = require('./signalStoreKeyPersistence');
const {
  decryptIdentityKeyBytes,
  encryptIdentityKeyBytes,
  serializeLocalIdentityKeyPair,
} = require('./signalStoreSessionIdentityStorage');
const { openSignalStoreDatabase } = require('./signalStoreDatabase');
const { createSQLiteRoomDistributionMap } = require('./signalStoreRoomDistribution');

// ---------------------------------------------------------------------------
// Store implementations
// ---------------------------------------------------------------------------

const getProtocolStoreClass = createCachedAsyncLoader(async () => {
  const {
    SessionStore,
    IdentityKeyStore,
    PreKeyStore,
    SignedPreKeyStore,
    KyberPreKeyStore,
    SenderKeyStore,
    SessionRecord,
    PreKeyRecord,
    SignedPreKeyRecord,
    KyberPreKeyRecord,
    SenderKeyRecord,
    PublicKey,
    IdentityKeyPair,
    IdentityChange,
  } = await importLibsignalModule();

const SQLiteSessionStore = createSessionStoreClass({
  SessionStoreBase: SessionStore,
  SessionRecord,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._save = db.prepare('INSERT OR REPLACE INTO sessions (address, record) VALUES (?, ?)');
    instance._get = db.prepare('SELECT record FROM sessions WHERE address = ?');
    instance._del = db.prepare('DELETE FROM sessions WHERE address = ?');
  },
  getMasterKey: (instance) => instance._mk,
  readStoredSession: (instance, addr) => instance._get.get(addr)?.record ?? null,
  writeStoredSession: (instance, addr, storedRecord) => instance._save.run(addr, storedRecord),
  deleteStoredSession: (instance, addr) => instance._del.run(addr),
});

const SQLiteIdentityKeyStore = createIdentityKeyStoreClass({
  IdentityKeyStoreBase: IdentityKeyStore,
  PublicKey,
  IdentityKeyPair,
  IdentityChange,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._getLocal = db.prepare('SELECT key_pair, registration_id FROM local_identity WHERE id = 1');
    instance._saveLocal = db.prepare('INSERT OR REPLACE INTO local_identity (id, key_pair, registration_id) VALUES (1, ?, ?)');
    instance._saveId = db.prepare('INSERT OR REPLACE INTO identity_keys (address, public_key, trusted, verified, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)');
    instance._getId = db.prepare('SELECT public_key, trusted, verified, first_seen, last_seen FROM identity_keys WHERE address = ?');
  },
  getMasterKey: (instance) => instance._mk,
  loadLocalIdentity(instance) {
    const row = instance._getLocal.get();
    if (!row) return null;
    return {
      serializedKeyPair: row.key_pair,
      registrationId: row.registration_id,
    };
  },
  saveLocalIdentityRecord(instance, keyPair, registrationId) {
    instance._saveLocal.run(serializeLocalIdentityKeyPair(instance._mk, keyPair), registrationId);
  },
  readIdentityRecord(instance, addr) {
    const row = instance._getId.get(addr);
    if (!row) return null;

    return {
      keyBytes: decryptIdentityKeyBytes(instance._mk, row.public_key, addr),
      trusted: !!row.trusted,
      verified: !!row.verified,
      firstSeen: row.first_seen ?? null,
      lastSeen: row.last_seen ?? null,
    };
  },
  writeIdentityRecord(instance, addr, keyBytes, { trusted = false, verified = false, firstSeen = Date.now(), lastSeen = Date.now() } = {}) {
    const blob = encryptIdentityKeyBytes(instance._mk, keyBytes, addr);
    instance._saveId.run(addr, blob, trusted ? 1 : 0, verified ? 1 : 0, firstSeen, lastSeen);
  },
});

const SQLitePreKeyStore = createPreKeyStoreClass({
  PreKeyStoreBase: PreKeyStore,
  PreKeyRecord,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._save = db.prepare('INSERT OR REPLACE INTO pre_keys (id, record) VALUES (?, ?)');
    instance._get = db.prepare('SELECT record FROM pre_keys WHERE id = ?');
    instance._del = db.prepare('DELETE FROM pre_keys WHERE id = ?');
    instance._maxId = db.prepare('SELECT MAX(id) as maxId FROM pre_keys');
    instance._count = db.prepare('SELECT COUNT(*) as cnt FROM pre_keys');
  },
  getMasterKey: (instance) => instance._mk,
  serializeRecord: serializePreKeyRecord,
  deserializeRecord: deserializePreKeyRecord,
  saveStoredRecord: (instance, id, blob) => instance._save.run(id, blob),
  readStoredRecord: (instance, id) => instance._get.get(id)?.record ?? null,
  deleteStoredRecord: (instance, id) => instance._del.run(id),
  getMaxKeyId: (instance) => instance._maxId.get()?.maxId ?? 0,
  getCount: (instance) => instance._count.get().cnt,
  getAllIds: (instance) => instance._db.prepare('SELECT id FROM pre_keys ORDER BY id').all().map((r) => r.id),
});

const SQLiteSignedPreKeyStore = createSignedPreKeyStoreClass({
  SignedPreKeyStoreBase: SignedPreKeyStore,
  SignedPreKeyRecord,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._save = db.prepare('INSERT OR REPLACE INTO signed_pre_keys (id, record) VALUES (?, ?)');
    instance._get = db.prepare('SELECT record FROM signed_pre_keys WHERE id = ?');
    instance._maxId = db.prepare('SELECT MAX(id) as maxId FROM signed_pre_keys');
  },
  getMasterKey: (instance) => instance._mk,
  serializeRecord: serializeSignedPreKeyRecord,
  deserializeRecord: deserializeSignedPreKeyRecord,
  saveStoredRecord: (instance, id, blob) => instance._save.run(id, blob),
  readStoredRecord: (instance, id) => instance._get.get(id)?.record ?? null,
  getMaxKeyId: (instance) => instance._maxId.get()?.maxId ?? 0,
});

const SQLiteKyberPreKeyStore = createKyberPreKeyStoreClass({
  KyberPreKeyStoreBase: KyberPreKeyStore,
  KyberPreKeyRecord,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._save = db.prepare('INSERT OR REPLACE INTO kyber_pre_keys (id, record, used) VALUES (?, ?, 0)');
    instance._get = db.prepare('SELECT record FROM kyber_pre_keys WHERE id = ?');
    instance._markUsed = db.prepare('UPDATE kyber_pre_keys SET used = 1 WHERE id = ?');
    instance._maxId = db.prepare('SELECT MAX(id) as maxId FROM kyber_pre_keys');
    instance._count = db.prepare('SELECT COUNT(*) as cnt FROM kyber_pre_keys WHERE used = 0');
  },
  getMasterKey: (instance) => instance._mk,
  serializeRecord: serializeKyberPreKeyRecord,
  deserializeRecord: deserializeKyberPreKeyRecord,
  saveStoredRecord: (instance, id, blob) => instance._save.run(id, blob),
  readStoredRecord: (instance, id) => instance._get.get(id)?.record ?? null,
  markStoredRecordUsed: (instance, id) => instance._markUsed.run(id),
  getMaxKeyId: (instance) => instance._maxId.get()?.maxId ?? 0,
  getCount: (instance) => instance._count.get().cnt,
  getAllIds: (instance) => instance._db.prepare('SELECT id FROM kyber_pre_keys WHERE used = 0 ORDER BY id').all().map((r) => r.id),
});

const SQLiteSenderKeyStore = createSenderKeyStoreClass({
  SenderKeyStoreBase: SenderKeyStore,
  SenderKeyRecord,
  initialize(instance, db, masterKey) {
    instance._db = db;
    instance._mk = masterKey;
    instance._save = db.prepare('INSERT OR REPLACE INTO sender_keys (address, distribution_id, record) VALUES (?, ?, ?)');
    instance._get = db.prepare('SELECT record FROM sender_keys WHERE address = ? AND distribution_id = ?');
    instance._delRoom = db.prepare('DELETE FROM sender_keys WHERE distribution_id = ?');
  },
  getMasterKey: (instance) => instance._mk,
  serializeRecord: serializeSenderKeyRecord,
  deserializeRecord: deserializeSenderKeyRecord,
  saveStoredRecord: (instance, addr, distributionId, blob) => instance._save.run(addr, distributionId, blob),
  readStoredRecord: (instance, addr, distributionId) => instance._get.get(addr, distributionId)?.record ?? null,
  deleteRoomRecords: (instance, distributionId) => instance._delRoom.run(distributionId),
});

// ---------------------------------------------------------------------------
// Protocol Store (aggregate)
// ---------------------------------------------------------------------------

const ProtocolStore = createProtocolStoreClass({
  initializeStoreState: ({ userId, masterKey }) => ({
    _db: openSignalStoreDatabase(userId),
    _mk: masterKey,
  }),
  createMemberFactories: ({ store, masterKey }) =>
    createSQLiteProtocolStoreMemberFactories({
      db: store._db,
      masterKey,
      SessionStoreClass: SQLiteSessionStore,
      IdentityStoreClass: SQLiteIdentityKeyStore,
      PreKeyStoreClass: SQLitePreKeyStore,
      SignedPreKeyStoreClass: SQLiteSignedPreKeyStore,
      KyberPreKeyStoreClass: SQLiteKyberPreKeyStore,
      SenderKeyStoreClass: SQLiteSenderKeyStore,
      createRoomDistributionMap: createSQLiteRoomDistributionMap,
    }),
  closeDatabase: (db) => db.close(),
});

  return ProtocolStore;
});

async function createProtocolStore(userId, masterKey) {
  const ProtocolStore = await getProtocolStoreClass();
  return createProtocolStoreWithFallback({
    createPrimaryStore: async () => new ProtocolStore(userId, masterKey),
    createFallbackStore: () => createMemoryProtocolStore(userId, masterKey),
    shouldFallback: shouldUseMemoryProtocolStoreFallback,
    onFallback: () => {
      console.warn('[Signal] better-sqlite3 unavailable; using in-memory Signal store fallback on Windows');
    },
  });
}

module.exports = { createProtocolStore };
