import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createIdentityKeyStoreClass,
  createSessionStoreClass,
} = require('../../../client/electron/crypto/signalProtocolStoreClassBuilders.js');
const {
  serializeLocalIdentityKeyPair,
} = require('../../../client/electron/crypto/signalStoreSessionIdentityStorage.js');

test('signal protocol store class builders create session stores with canonical save, load, list, and remove behavior', async () => {
  class SessionStoreBase {}
  const SessionRecord = {
    deserialize(bytes) {
      return { payload: Buffer.from(bytes).toString('utf8') };
    },
  };

  const SessionStoreClass = createSessionStoreClass({
    SessionStoreBase,
    SessionRecord,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._records = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    readStoredSession: (instance, addr) => instance._records.get(addr) ?? null,
    writeStoredSession: (instance, addr, storedRecord) => instance._records.set(addr, storedRecord),
    deleteStoredSession: (instance, addr) => instance._records.delete(addr),
  });

  const store = new SessionStoreClass(Buffer.alloc(32, 7));
  const sessionAddress = { toString: () => 'alice.1' };
  const missingAddress = { toString: () => 'alice.2' };

  await store.saveSession(sessionAddress, {
    serialize() {
      return Buffer.from('session-record');
    },
  });

  assert.deepEqual(await store.getSession(sessionAddress), { payload: 'session-record' });
  assert.deepEqual(await store.getExistingSessions([sessionAddress, missingAddress]), [
    { payload: 'session-record' },
  ]);
  await store.removeSession(sessionAddress);
  assert.equal(await store.getSession(sessionAddress), null);
});

test('signal protocol store class builders create identity stores with canonical local identity and trust behavior', async () => {
  class IdentityKeyStoreBase {}
  const IdentityKeyPair = {
    deserialize(bytes) {
      const value = Buffer.from(bytes).toString('utf8');
      return {
        privateKey: `priv:${value}`,
        publicKey: `pub:${value}`,
      };
    },
  };
  const PublicKey = {
    deserialize(bytes) {
      return { publicKey: Buffer.from(bytes).toString('utf8') };
    },
  };
  const IdentityChange = {
    NewOrUnchanged: 'same',
    ReplacedExisting: 'replaced',
  };

  const IdentityStoreClass = createIdentityKeyStoreClass({
    IdentityKeyStoreBase,
    PublicKey,
    IdentityKeyPair,
    IdentityChange,
    initialize(instance, masterKey) {
      instance._mk = masterKey;
      instance._localIdentity = null;
      instance._identityRecords = new Map();
    },
    getMasterKey: (instance) => instance._mk,
    loadLocalIdentity(instance) {
      return instance._localIdentity;
    },
    saveLocalIdentityRecord(instance, keyPair, registrationId) {
      instance._localIdentity = {
        serializedKeyPair: serializeLocalIdentityKeyPair(instance._mk, keyPair),
        registrationId,
      };
    },
    readIdentityRecord(instance, address) {
      return instance._identityRecords.get(address) ?? null;
    },
    writeIdentityRecord(instance, address, keyBytes, options = {}) {
      instance._identityRecords.set(address, {
        keyBytes,
        trusted: !!options.trusted,
        verified: !!options.verified,
        firstSeen: options.firstSeen ?? null,
        lastSeen: options.lastSeen ?? null,
      });
    },
  });

  const store = new IdentityStoreClass(Buffer.alloc(32, 9));
  const address = { toString: () => 'bob.1' };
  const keyPair = {
    serialize() {
      return Buffer.from('local-pair');
    },
  };
  const identityKey = {
    serialize() {
      return Buffer.from('identity-key');
    },
  };

  store.saveLocalIdentity(keyPair, 42);
  assert.equal(store.hasLocalIdentity(), true);
  assert.equal(await store.getIdentityKey(), 'priv:local-pair');
  assert.equal(await store.getLocalRegistrationId(), 42);
  assert.deepEqual(store.getLocalIdentityKeyPair(), {
    privateKey: 'priv:local-pair',
    publicKey: 'pub:local-pair',
  });

  const approved = await store.approveIdentity(address, identityKey, { verified: true });
  assert.deepEqual(approved, { changed: false, verified: true });
  assert.deepEqual(await store.getTrustState(address, identityKey), {
    status: 'trusted',
    trusted: true,
    verified: true,
    firstSeen: store._identityRecords.get('bob.1').firstSeen,
    lastSeen: store._identityRecords.get('bob.1').lastSeen,
    identityKey: Buffer.from('identity-key').toString('base64'),
  });
  assert.equal(await store.isTrustedIdentity(address, identityKey), true);
  assert.deepEqual(await store.getIdentity(address), { publicKey: 'identity-key' });

  const saveResult = await store.saveIdentity(
    { toString: () => 'carol.1' },
    {
      serialize() {
        return Buffer.from('carol-key');
      },
    }
  );
  assert.equal(saveResult, 'same');
});
