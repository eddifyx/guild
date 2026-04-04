const { importLibsignalModule } = require('./runtimeModules');
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
  createProtocolStoreClass,
} = require('./signalProtocolStoreAggregate');
const {
  createMemoryProtocolStoreMemberFactories,
} = require('./signalProtocolStoreMemberFactories');
const {
  deserializeKyberPreKeyRecord,
  deserializePreKeyRecord,
  deserializeSenderKeyRecord,
  deserializeSignedPreKeyRecord,
  buildSenderKeyAad,
  buildSenderKeyStorageKey,
  countUnusedMapEntries,
  getMapMaxKeyId,
  getSortedMapKeyIds,
  getSortedUnusedMapKeyIds,
  isSenderKeyStorageKeyForDistribution,
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
const { createMemoryRoomDistributionMap } = require('./signalStoreRoomDistribution');

const getMemoryProtocolStoreClass = createCachedAsyncLoader(async () => {
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

      const MemorySessionStore = createSessionStoreClass({
        SessionStoreBase: SessionStore,
        SessionRecord,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._sessions = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        readStoredSession: (instance, addr) => instance._sessions.get(addr) ?? null,
        writeStoredSession: (instance, addr, storedRecord) => instance._sessions.set(addr, storedRecord),
        deleteStoredSession: (instance, addr) => instance._sessions.delete(addr),
      });

      const MemoryIdentityKeyStore = createIdentityKeyStoreClass({
        IdentityKeyStoreBase: IdentityKeyStore,
        PublicKey,
        IdentityKeyPair,
        IdentityChange,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._localIdentity = null;
          instance._identityKeys = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        loadLocalIdentity(instance) {
          if (!instance._localIdentity) return null;
          return {
            serializedKeyPair: instance._localIdentity.keyPair,
            registrationId: instance._localIdentity.registrationId,
          };
        },
        saveLocalIdentityRecord(instance, keyPair, registrationId) {
          instance._localIdentity = {
            keyPair: serializeLocalIdentityKeyPair(instance._mk, keyPair),
            registrationId,
          };
        },
        readIdentityRecord(instance, addr) {
          const row = instance._identityKeys.get(addr);
          if (!row) return null;

          return {
            keyBytes: decryptIdentityKeyBytes(instance._mk, row.publicKey, addr),
            trusted: row.trusted,
            verified: row.verified,
            firstSeen: row.firstSeen ?? null,
            lastSeen: row.lastSeen ?? null,
          };
        },
        writeIdentityRecord(instance, addr, keyBytes, { trusted = false, verified = false, firstSeen = Date.now(), lastSeen = Date.now() } = {}) {
          instance._identityKeys.set(addr, {
            publicKey: encryptIdentityKeyBytes(instance._mk, keyBytes, addr),
            trusted: !!trusted,
            verified: !!verified,
            firstSeen,
            lastSeen,
          });
        },
      });

      const MemoryPreKeyStore = createPreKeyStoreClass({
        PreKeyStoreBase: PreKeyStore,
        PreKeyRecord,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._preKeys = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        serializeRecord: serializePreKeyRecord,
        deserializeRecord: deserializePreKeyRecord,
        saveStoredRecord: (instance, id, blob) => instance._preKeys.set(id, blob),
        readStoredRecord: (instance, id) => instance._preKeys.get(id) ?? null,
        deleteStoredRecord: (instance, id) => instance._preKeys.delete(id),
        getMaxKeyId: (instance) => getMapMaxKeyId(instance._preKeys),
        getCount: (instance) => instance._preKeys.size,
        getAllIds: (instance) => getSortedMapKeyIds(instance._preKeys),
      });

      const MemorySignedPreKeyStore = createSignedPreKeyStoreClass({
        SignedPreKeyStoreBase: SignedPreKeyStore,
        SignedPreKeyRecord,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._signedPreKeys = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        serializeRecord: serializeSignedPreKeyRecord,
        deserializeRecord: deserializeSignedPreKeyRecord,
        saveStoredRecord: (instance, id, blob) => instance._signedPreKeys.set(id, blob),
        readStoredRecord: (instance, id) => instance._signedPreKeys.get(id) ?? null,
        getMaxKeyId: (instance) => getMapMaxKeyId(instance._signedPreKeys),
      });

      const MemoryKyberPreKeyStore = createKyberPreKeyStoreClass({
        KyberPreKeyStoreBase: KyberPreKeyStore,
        KyberPreKeyRecord,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._kyberPreKeys = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        serializeRecord: serializeKyberPreKeyRecord,
        deserializeRecord: deserializeKyberPreKeyRecord,
        saveStoredRecord: (instance, id, blob) => instance._kyberPreKeys.set(id, { record: blob, used: false }),
        readStoredRecord: (instance, id) => instance._kyberPreKeys.get(id)?.record ?? null,
        markStoredRecordUsed(instance, id) {
          const entry = instance._kyberPreKeys.get(id);
          if (entry) entry.used = true;
        },
        getMaxKeyId: (instance) => getMapMaxKeyId(instance._kyberPreKeys),
        getCount: (instance) => countUnusedMapEntries(instance._kyberPreKeys),
        getAllIds: (instance) => getSortedUnusedMapKeyIds(instance._kyberPreKeys),
      });

      const MemorySenderKeyStore = createSenderKeyStoreClass({
        SenderKeyStoreBase: SenderKeyStore,
        SenderKeyRecord,
        initialize(instance, masterKey) {
          instance._mk = masterKey;
          instance._senderKeys = new Map();
        },
        getMasterKey: (instance) => instance._mk,
        serializeRecord: serializeSenderKeyRecord,
        deserializeRecord: deserializeSenderKeyRecord,
        saveStoredRecord: (instance, addr, distributionId, blob) => instance._senderKeys.set(buildSenderKeyStorageKey(addr, distributionId), blob),
        readStoredRecord: (instance, addr, distributionId) => instance._senderKeys.get(buildSenderKeyStorageKey(addr, distributionId)) ?? null,
        deleteRoomRecords(instance, distributionId) {
          for (const key of instance._senderKeys.keys()) {
            if (isSenderKeyStorageKeyForDistribution(key, distributionId)) {
              instance._senderKeys.delete(key);
            }
          }
        },
      });

      const MemoryProtocolStore = createProtocolStoreClass({
        initializeStoreState: ({ masterKey }) => ({
          _mk: masterKey,
        }),
        createMemberFactories: ({ masterKey }) =>
          createMemoryProtocolStoreMemberFactories({
            masterKey,
            SessionStoreClass: MemorySessionStore,
            IdentityStoreClass: MemoryIdentityKeyStore,
            PreKeyStoreClass: MemoryPreKeyStore,
            SignedPreKeyStoreClass: MemorySignedPreKeyStore,
            KyberPreKeyStoreClass: MemoryKyberPreKeyStore,
            SenderKeyStoreClass: MemorySenderKeyStore,
            createRoomDistributionMap: createMemoryRoomDistributionMap,
          }),
      });

  return MemoryProtocolStore;
});

async function createMemoryProtocolStore(userId, masterKey) {
  const MemoryProtocolStore = await getMemoryProtocolStoreClass();
  return new MemoryProtocolStore(userId, masterKey);
}

module.exports = { createMemoryProtocolStore };
