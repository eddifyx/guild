const crypto = require('crypto');
const { importLibsignalModule } = require('./runtimeModules');

let memoryProtocolStoreClassPromise = null;

function encrypt(masterKey, data, aad) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, ct]);
}

function decrypt(masterKey, blob, aad) {
  const nonce = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

async function getMemoryProtocolStoreClass() {
  if (!memoryProtocolStoreClassPromise) {
    memoryProtocolStoreClassPromise = (async () => {
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

      class MemorySessionStore extends SessionStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._sessions = new Map();
        }

        async saveSession(address, record) {
          const addr = address.toString();
          const blob = encrypt(this._mk, Buffer.from(record.serialize()), `session:${addr}`);
          this._sessions.set(addr, blob);
        }

        async getSession(address) {
          const addr = address.toString();
          const record = this._sessions.get(addr);
          if (!record) return null;
          const data = decrypt(this._mk, record, `session:${addr}`);
          return SessionRecord.deserialize(data);
        }

        async getExistingSessions(addresses) {
          const results = [];
          for (const addr of addresses) {
            const session = await this.getSession(addr);
            if (session) results.push(session);
          }
          return results;
        }

        async removeSession(address) {
          this._sessions.delete(address.toString());
        }
      }

      class MemoryIdentityKeyStore extends IdentityKeyStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._localIdentity = null;
          this._identityKeys = new Map();
        }

        saveLocalIdentity(keyPair, registrationId) {
          this._localIdentity = {
            keyPair: encrypt(this._mk, Buffer.from(keyPair.serialize()), 'local_identity'),
            registrationId,
          };
        }

        hasLocalIdentity() {
          return !!this._localIdentity;
        }

        _readIdentityRecord(addr) {
          const row = this._identityKeys.get(addr);
          if (!row) return null;

          return {
            keyBytes: decrypt(this._mk, row.publicKey, `identity:${addr}`),
            trusted: row.trusted,
            verified: row.verified,
            firstSeen: row.firstSeen ?? null,
            lastSeen: row.lastSeen ?? null,
          };
        }

        _writeIdentityRecord(addr, keyBytes, { trusted = false, verified = false, firstSeen = Date.now(), lastSeen = Date.now() } = {}) {
          this._identityKeys.set(addr, {
            publicKey: encrypt(this._mk, keyBytes, `identity:${addr}`),
            trusted: !!trusted,
            verified: !!verified,
            firstSeen,
            lastSeen,
          });
        }

        async getIdentityKey() {
          if (!this._localIdentity) throw new Error('No local identity key');
          const data = decrypt(this._mk, this._localIdentity.keyPair, 'local_identity');
          return IdentityKeyPair.deserialize(data).privateKey;
        }

        async getLocalRegistrationId() {
          if (!this._localIdentity) throw new Error('No local identity');
          return this._localIdentity.registrationId;
        }

        async approveIdentity(address, key, options = {}) {
          const addr = address.toString();
          const existing = this._readIdentityRecord(addr);
          const keyBytes = Buffer.from(key.serialize());
          const now = Date.now();
          const changed = existing ? !keyBytes.equals(existing.keyBytes) : false;
          const verified = options.verified === true ? true : (changed ? false : !!existing?.verified);

          this._writeIdentityRecord(addr, keyBytes, {
            trusted: true,
            verified,
            firstSeen: existing?.firstSeen ?? now,
            lastSeen: now,
          });

          return { changed, verified };
        }

        async markIdentityVerified(address, key) {
          return this.approveIdentity(address, key, { verified: true });
        }

        async getTrustState(address, key = null) {
          const addr = address.toString();
          const existing = this._readIdentityRecord(addr);
          if (!existing) {
            return {
              status: 'new',
              trusted: false,
              verified: false,
              firstSeen: null,
              lastSeen: null,
              identityKey: null,
            };
          }

          const candidateBytes = key ? Buffer.from(key.serialize()) : null;
          if (candidateBytes && !candidateBytes.equals(existing.keyBytes)) {
            return {
              status: 'key_changed',
              trusted: false,
              verified: false,
              firstSeen: existing.firstSeen,
              lastSeen: existing.lastSeen,
              identityKey: existing.keyBytes.toString('base64'),
            };
          }

          return {
            status: existing.trusted ? 'trusted' : 'new',
            trusted: existing.trusted,
            verified: existing.verified,
            firstSeen: existing.firstSeen,
            lastSeen: existing.lastSeen,
            identityKey: existing.keyBytes.toString('base64'),
          };
        }

        async saveIdentity(address, key) {
          const addr = address.toString();
          const existing = this._readIdentityRecord(addr);
          const keyBytes = Buffer.from(key.serialize());
          const now = Date.now();

          if (!existing) {
            this._writeIdentityRecord(addr, keyBytes, {
              trusted: false,
              verified: false,
              firstSeen: now,
              lastSeen: now,
            });
            return IdentityChange.NewOrUnchanged;
          }

          const changed = !keyBytes.equals(existing.keyBytes);
          if (changed) {
            this._writeIdentityRecord(addr, keyBytes, {
              trusted: false,
              verified: false,
              firstSeen: existing.firstSeen ?? now,
              lastSeen: now,
            });
            return IdentityChange.ReplacedExisting;
          }

          this._writeIdentityRecord(addr, keyBytes, {
            trusted: existing.trusted,
            verified: existing.verified,
            firstSeen: existing.firstSeen ?? now,
            lastSeen: now,
          });
          return IdentityChange.NewOrUnchanged;
        }

        async isTrustedIdentity(address, key) {
          const addr = address.toString();
          const existing = this._readIdentityRecord(addr);
          if (!existing || !existing.trusted) return false;

          const newKey = Buffer.from(key.serialize());
          return newKey.equals(existing.keyBytes);
        }

        async getIdentity(address) {
          const addr = address.toString();
          const existing = this._readIdentityRecord(addr);
          if (!existing) return null;
          return PublicKey.deserialize(existing.keyBytes);
        }

        getLocalIdentityKeyPair() {
          if (!this._localIdentity) return null;
          const data = decrypt(this._mk, this._localIdentity.keyPair, 'local_identity');
          return IdentityKeyPair.deserialize(data);
        }
      }

      class MemoryPreKeyStore extends PreKeyStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._preKeys = new Map();
        }

        async savePreKey(id, record) {
          const blob = encrypt(this._mk, Buffer.from(record.serialize()), `prekey:${id}`);
          this._preKeys.set(id, blob);
        }

        async getPreKey(id) {
          const record = this._preKeys.get(id);
          if (!record) throw new Error(`PreKey ${id} not found`);
          const data = decrypt(this._mk, record, `prekey:${id}`);
          return PreKeyRecord.deserialize(data);
        }

        async removePreKey(id) {
          this._preKeys.delete(id);
        }

        getMaxKeyId() {
          return this._preKeys.size ? Math.max(...this._preKeys.keys()) : 0;
        }

        getCount() {
          return this._preKeys.size;
        }

        getAllIds() {
          return [...this._preKeys.keys()].sort((a, b) => a - b);
        }
      }

      class MemorySignedPreKeyStore extends SignedPreKeyStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._signedPreKeys = new Map();
        }

        async saveSignedPreKey(id, record) {
          const blob = encrypt(this._mk, Buffer.from(record.serialize()), `spk:${id}`);
          this._signedPreKeys.set(id, blob);
        }

        async getSignedPreKey(id) {
          const record = this._signedPreKeys.get(id);
          if (!record) throw new Error(`SignedPreKey ${id} not found`);
          const data = decrypt(this._mk, record, `spk:${id}`);
          return SignedPreKeyRecord.deserialize(data);
        }

        getMaxKeyId() {
          return this._signedPreKeys.size ? Math.max(...this._signedPreKeys.keys()) : 0;
        }
      }

      class MemoryKyberPreKeyStore extends KyberPreKeyStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._kyberPreKeys = new Map();
        }

        async saveKyberPreKey(id, record) {
          const blob = encrypt(this._mk, Buffer.from(record.serialize()), `kyber:${id}`);
          this._kyberPreKeys.set(id, { record: blob, used: false });
        }

        async getKyberPreKey(id) {
          const entry = this._kyberPreKeys.get(id);
          if (!entry) throw new Error(`KyberPreKey ${id} not found`);
          const data = decrypt(this._mk, entry.record, `kyber:${id}`);
          return KyberPreKeyRecord.deserialize(data);
        }

        async markKyberPreKeyUsed(id) {
          const entry = this._kyberPreKeys.get(id);
          if (entry) entry.used = true;
        }

        getMaxKeyId() {
          return this._kyberPreKeys.size ? Math.max(...this._kyberPreKeys.keys()) : 0;
        }

        getCount() {
          return [...this._kyberPreKeys.values()].filter((entry) => !entry.used).length;
        }

        getAllIds() {
          return [...this._kyberPreKeys.entries()]
            .filter(([, entry]) => !entry.used)
            .map(([id]) => id)
            .sort((a, b) => a - b);
        }
      }

      class MemorySenderKeyStore extends SenderKeyStore {
        constructor(masterKey) {
          super();
          this._mk = masterKey;
          this._senderKeys = new Map();
        }

        _key(addr, distributionId) {
          return `${addr}::${distributionId}`;
        }

        async saveSenderKey(address, distributionId, record) {
          const addr = address.toString();
          const aad = `sk:${addr}:${distributionId}`;
          const blob = encrypt(this._mk, Buffer.from(record.serialize()), aad);
          this._senderKeys.set(this._key(addr, distributionId), blob);
        }

        async getSenderKey(address, distributionId) {
          const addr = address.toString();
          const record = this._senderKeys.get(this._key(addr, distributionId));
          if (!record) return null;
          const aad = `sk:${addr}:${distributionId}`;
          const data = decrypt(this._mk, record, aad);
          return SenderKeyRecord.deserialize(data);
        }

        deleteSenderKeysForRoom(distributionId) {
          for (const key of this._senderKeys.keys()) {
            if (key.endsWith(`::${distributionId}`)) {
              this._senderKeys.delete(key);
            }
          }
        }
      }

      class RoomDistributionMap {
        constructor() {
          this._roomDistribution = new Map();
        }

        getOrCreate(roomId) {
          const existing = this._roomDistribution.get(roomId);
          if (existing) return existing;
          const id = crypto.randomUUID();
          this._roomDistribution.set(roomId, id);
          return id;
        }

        get(roomId) {
          return this._roomDistribution.get(roomId) ?? null;
        }

        reset(roomId) {
          const id = crypto.randomUUID();
          this._roomDistribution.set(roomId, id);
          return id;
        }
      }

      class MemoryProtocolStore {
        constructor(_userId, masterKey) {
          this._mk = masterKey;
          this.session = new MemorySessionStore(masterKey);
          this.identity = new MemoryIdentityKeyStore(masterKey);
          this.preKey = new MemoryPreKeyStore(masterKey);
          this.signedPreKey = new MemorySignedPreKeyStore(masterKey);
          this.kyberPreKey = new MemoryKyberPreKeyStore(masterKey);
          this.senderKey = new MemorySenderKeyStore(masterKey);
          this.roomDistribution = new RoomDistributionMap();
        }

        async removeSession(address) {
          await this.session.removeSession(address);
        }

        close() {
          if (this._mk) {
            this._mk.fill(0);
            this._mk = null;
          }
        }
      }

      return MemoryProtocolStore;
    })();
  }

  return memoryProtocolStoreClassPromise;
}

async function createMemoryProtocolStore(userId, masterKey) {
  const MemoryProtocolStore = await getMemoryProtocolStoreClass();
  return new MemoryProtocolStore(userId, masterKey);
}

module.exports = { createMemoryProtocolStore };
