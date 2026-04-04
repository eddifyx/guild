import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  approveStoredIdentity,
  getStoredIdentity,
  getStoredIdentityPrivateKey,
  getStoredLocalIdentityKeyPair,
  getStoredLocalRegistrationId,
  getStoredTrustState,
  isStoredIdentityTrusted,
  saveStoredIdentity,
} = require('../../../client/electron/crypto/signalStoreIdentityMethods.js');
const {
  serializeLocalIdentityKeyPair,
} = require('../../../client/electron/crypto/signalStoreSessionIdentityStorage.js');

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

class FakePublicKey {
  constructor(payload) {
    this.payload = Buffer.from(payload);
  }

  serialize() {
    return this.payload;
  }

  static deserialize(data) {
    return new FakePublicKey(data);
  }
}

const IdentityChange = {
  NewOrUnchanged: 1,
  ReplacedExisting: 2,
};

function createKey(payload) {
  return {
    serialize() {
      return Buffer.from(payload);
    },
  };
}

test('signal store identity methods reuse local identity decoding across registration and key lookups', () => {
  const masterKey = Buffer.alloc(32, 7);
  const loadLocalIdentity = () => ({
    serializedKeyPair: serializeLocalIdentityKeyPair(
      masterKey,
      new FakeIdentityKeyPair('local-identity')
    ),
    registrationId: 77,
  });

  const keyPair = getStoredLocalIdentityKeyPair({
    loadLocalIdentity,
    masterKey,
    IdentityKeyPair: FakeIdentityKeyPair,
  });

  assert.equal(keyPair.privateKey, 'local-identity:private');
  assert.equal(
    getStoredIdentityPrivateKey({
      loadLocalIdentity,
      masterKey,
      IdentityKeyPair: FakeIdentityKeyPair,
    }),
    'local-identity:private'
  );
  assert.equal(
    getStoredLocalRegistrationId({
      loadLocalIdentity,
    }),
    77
  );
});

test('signal store identity methods delegate approval, save, trust, and public key resolution through one shared record path', async () => {
  const records = new Map();
  const writes = [];
  const readIdentityRecord = (addr) => records.get(addr) ?? null;
  const writeIdentityRecord = (addr, keyBytes, record) => {
    writes.push({ addr, keyBytes: Buffer.from(keyBytes), record });
    records.set(addr, { keyBytes: Buffer.from(keyBytes), ...record });
  };

  const approved = await approveStoredIdentity({
    address: { toString: () => 'user.9:1' },
    key: createKey('key-a'),
    options: { verified: true },
    readIdentityRecord,
    writeIdentityRecord,
  });

  const trustState = await getStoredTrustState({
    address: { toString: () => 'user.9:1' },
    key: createKey('key-a'),
    readIdentityRecord,
  });

  const saved = await saveStoredIdentity({
    address: { toString: () => 'user.9:2' },
    key: createKey('key-b'),
    readIdentityRecord,
    writeIdentityRecord,
    IdentityChange,
  });

  const trusted = await isStoredIdentityTrusted({
    address: { toString: () => 'user.9:1' },
    key: createKey('key-a'),
    readIdentityRecord,
  });

  const publicKey = await getStoredIdentity({
    address: { toString: () => 'user.9:2' },
    readIdentityRecord,
    PublicKey: FakePublicKey,
  });

  assert.deepEqual(approved, { changed: false, verified: true });
  assert.equal(trustState.trusted, true);
  assert.equal(saved, IdentityChange.NewOrUnchanged);
  assert.equal(trusted, true);
  assert.deepEqual(publicKey.payload, Buffer.from('key-b'));
  assert.equal(writes.length, 2);
});
