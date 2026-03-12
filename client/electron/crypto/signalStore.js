/**
 * /guild — libsignal Protocol Store (SQLite-backed)
 *
 * Implements the 6 abstract store classes required by @signalapp/libsignal-client:
 *   SessionStore, IdentityKeyStore, PreKeyStore, SignedPreKeyStore,
 *   KyberPreKeyStore, SenderKeyStore
 *
 * All records are serialized via libsignal's .serialize() and stored as BLOBs
 * in a local SQLite database (better-sqlite3). BLOBs are encrypted with
 * AES-256-GCM using the master key from Electron safeStorage.
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const { app } = require('electron');

let protocolStoreClassPromise = null;

// ---------------------------------------------------------------------------
// AES-256-GCM encryption for at-rest storage
// ---------------------------------------------------------------------------

function encrypt(masterKey, data, aad) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  // nonce(12) || tag(16) || ciphertext
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

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_identity (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    key_pair BLOB NOT NULL,
    registration_id INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS identity_keys (
    address TEXT PRIMARY KEY,
    public_key BLOB NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 1,
    verified INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER,
    last_seen INTEGER
  );

  CREATE TABLE IF NOT EXISTS pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signed_pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kyber_pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    address TEXT PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sender_keys (
    address TEXT NOT NULL,
    distribution_id TEXT NOT NULL,
    record BLOB NOT NULL,
    PRIMARY KEY (address, distribution_id)
  );

  CREATE TABLE IF NOT EXISTS room_distribution (
    room_id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL
  );
`;

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map(row => row.name);
  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

function migrateDatabase(db) {
  ensureColumn(db, 'identity_keys', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'identity_keys', 'first_seen', 'INTEGER');
  ensureColumn(db, 'identity_keys', 'last_seen', 'INTEGER');
}

function openDatabase(userId) {
  const dbPath = path.join(app.getPath('userData'), `signal-protocol-${userId}.db`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateDatabase(db);
  return db;
}

// ---------------------------------------------------------------------------
// Store implementations
// ---------------------------------------------------------------------------

async function getProtocolStoreClass() {
  if (!protocolStoreClassPromise) {
    protocolStoreClassPromise = (async () => {
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
      } = await import('@signalapp/libsignal-client');

class SQLiteSessionStore extends SessionStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._save = db.prepare('INSERT OR REPLACE INTO sessions (address, record) VALUES (?, ?)');
    this._get = db.prepare('SELECT record FROM sessions WHERE address = ?');
  }

  async saveSession(address, record) {
    const addr = address.toString();
    const blob = encrypt(this._mk, Buffer.from(record.serialize()), `session:${addr}`);
    this._save.run(addr, blob);
  }

  async getSession(address) {
    const addr = address.toString();
    const row = this._get.get(addr);
    if (!row) return null;
    const data = decrypt(this._mk, row.record, `session:${addr}`);
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
}

class SQLiteIdentityKeyStore extends IdentityKeyStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._getLocal = db.prepare('SELECT key_pair, registration_id FROM local_identity WHERE id = 1');
    this._saveLocal = db.prepare('INSERT OR REPLACE INTO local_identity (id, key_pair, registration_id) VALUES (1, ?, ?)');
    this._saveId = db.prepare('INSERT OR REPLACE INTO identity_keys (address, public_key, trusted, verified, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)');
    this._getId = db.prepare('SELECT public_key, trusted, verified, first_seen, last_seen FROM identity_keys WHERE address = ?');
  }

  saveLocalIdentity(keyPair, registrationId) {
    const blob = encrypt(this._mk, Buffer.from(keyPair.serialize()), 'local_identity');
    this._saveLocal.run(blob, registrationId);
  }

  hasLocalIdentity() {
    return !!this._getLocal.get();
  }

  _readIdentityRecord(addr) {
    const row = this._getId.get(addr);
    if (!row) return null;

    return {
      keyBytes: decrypt(this._mk, row.public_key, 'identity:' + addr),
      trusted: !!row.trusted,
      verified: !!row.verified,
      firstSeen: row.first_seen ?? null,
      lastSeen: row.last_seen ?? null,
    };
  }

  _writeIdentityRecord(addr, keyBytes, { trusted = false, verified = false, firstSeen = Date.now(), lastSeen = Date.now() } = {}) {
    const blob = encrypt(this._mk, keyBytes, 'identity:' + addr);
    this._saveId.run(addr, blob, trusted ? 1 : 0, verified ? 1 : 0, firstSeen, lastSeen);
  }

  async getIdentityKey() {
    const row = this._getLocal.get();
    if (!row) throw new Error('No local identity key');
    const data = decrypt(this._mk, row.key_pair, 'local_identity');
    return IdentityKeyPair.deserialize(data).privateKey;
  }

  async getLocalRegistrationId() {
    const row = this._getLocal.get();
    if (!row) throw new Error('No local identity');
    return row.registration_id;
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

  async isTrustedIdentity(address, key, _direction) {
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
    const row = this._getLocal.get();
    if (!row) return null;
    const data = decrypt(this._mk, row.key_pair, 'local_identity');
    return IdentityKeyPair.deserialize(data);
  }
}

class SQLitePreKeyStore extends PreKeyStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._save = db.prepare('INSERT OR REPLACE INTO pre_keys (id, record) VALUES (?, ?)');
    this._get = db.prepare('SELECT record FROM pre_keys WHERE id = ?');
    this._del = db.prepare('DELETE FROM pre_keys WHERE id = ?');
    this._maxId = db.prepare('SELECT MAX(id) as maxId FROM pre_keys');
    this._count = db.prepare('SELECT COUNT(*) as cnt FROM pre_keys');
  }

  async savePreKey(id, record) {
    const blob = encrypt(this._mk, Buffer.from(record.serialize()), `prekey:${id}`);
    this._save.run(id, blob);
  }

  async getPreKey(id) {
    const row = this._get.get(id);
    if (!row) throw new Error(`PreKey ${id} not found`);
    const data = decrypt(this._mk, row.record, `prekey:${id}`);
    return PreKeyRecord.deserialize(data);
  }

  async removePreKey(id) {
    this._del.run(id);
  }

  getMaxKeyId() {
    const row = this._maxId.get();
    return row?.maxId ?? 0;
  }

  getCount() {
    return this._count.get().cnt;
  }

  // Bulk query: returns all remaining prekey [{id, record}] rows (avoids O(maxId) iteration)
  getAllIds() {
    return this._db.prepare('SELECT id FROM pre_keys ORDER BY id').all().map(r => r.id);
  }
}

class SQLiteSignedPreKeyStore extends SignedPreKeyStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._save = db.prepare('INSERT OR REPLACE INTO signed_pre_keys (id, record) VALUES (?, ?)');
    this._get = db.prepare('SELECT record FROM signed_pre_keys WHERE id = ?');
    this._maxId = db.prepare('SELECT MAX(id) as maxId FROM signed_pre_keys');
  }

  async saveSignedPreKey(id, record) {
    const blob = encrypt(this._mk, Buffer.from(record.serialize()), `spk:${id}`);
    this._save.run(id, blob);
  }

  async getSignedPreKey(id) {
    const row = this._get.get(id);
    if (!row) throw new Error(`SignedPreKey ${id} not found`);
    const data = decrypt(this._mk, row.record, `spk:${id}`);
    return SignedPreKeyRecord.deserialize(data);
  }

  getMaxKeyId() {
    const row = this._maxId.get();
    return row?.maxId ?? 0;
  }
}

class SQLiteKyberPreKeyStore extends KyberPreKeyStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._save = db.prepare('INSERT OR REPLACE INTO kyber_pre_keys (id, record, used) VALUES (?, ?, 0)');
    this._get = db.prepare('SELECT record FROM kyber_pre_keys WHERE id = ?');
    this._markUsed = db.prepare('UPDATE kyber_pre_keys SET used = 1 WHERE id = ?');
    this._maxId = db.prepare('SELECT MAX(id) as maxId FROM kyber_pre_keys');
    this._count = db.prepare('SELECT COUNT(*) as cnt FROM kyber_pre_keys WHERE used = 0');
  }

  async saveKyberPreKey(id, record) {
    const blob = encrypt(this._mk, Buffer.from(record.serialize()), `kyber:${id}`);
    this._save.run(id, blob);
  }

  async getKyberPreKey(id) {
    const row = this._get.get(id);
    if (!row) throw new Error(`KyberPreKey ${id} not found`);
    const data = decrypt(this._mk, row.record, `kyber:${id}`);
    return KyberPreKeyRecord.deserialize(data);
  }

  async markKyberPreKeyUsed(id) {
    this._markUsed.run(id);
  }

  getMaxKeyId() {
    const row = this._maxId.get();
    return row?.maxId ?? 0;
  }

  getCount() {
    return this._count.get().cnt;
  }

  getAllIds() {
    return this._db.prepare('SELECT id FROM kyber_pre_keys WHERE used = 0 ORDER BY id').all().map(r => r.id);
  }
}

class SQLiteSenderKeyStore extends SenderKeyStore {
  constructor(db, masterKey) {
    super();
    this._db = db;
    this._mk = masterKey;
    this._save = db.prepare('INSERT OR REPLACE INTO sender_keys (address, distribution_id, record) VALUES (?, ?, ?)');
    this._get = db.prepare('SELECT record FROM sender_keys WHERE address = ? AND distribution_id = ?');
    this._delRoom = db.prepare('DELETE FROM sender_keys WHERE distribution_id = ?');
  }

  async saveSenderKey(address, distributionId, record) {
    const addr = address.toString();
    const aad = `sk:${addr}:${distributionId}`;
    const blob = encrypt(this._mk, Buffer.from(record.serialize()), aad);
    this._save.run(addr, distributionId, blob);
  }

  async getSenderKey(address, distributionId) {
    const addr = address.toString();
    const row = this._get.get(addr, distributionId);
    if (!row) return null;
    const aad = `sk:${addr}:${distributionId}`;
    const data = decrypt(this._mk, row.record, aad);
    return SenderKeyRecord.deserialize(data);
  }

  deleteSenderKeysForRoom(distributionId) {
    this._delRoom.run(distributionId);
  }
}

// ---------------------------------------------------------------------------
// Room → Distribution ID mapping
// ---------------------------------------------------------------------------

class RoomDistributionMap {
  constructor(db) {
    this._save = db.prepare('INSERT OR REPLACE INTO room_distribution (room_id, distribution_id) VALUES (?, ?)');
    this._get = db.prepare('SELECT distribution_id FROM room_distribution WHERE room_id = ?');
    this._del = db.prepare('DELETE FROM room_distribution WHERE room_id = ?');
  }

  getOrCreate(roomId) {
    const row = this._get.get(roomId);
    if (row) return row.distribution_id;
    const id = crypto.randomUUID();
    this._save.run(roomId, id);
    return id;
  }

  get(roomId) {
    const row = this._get.get(roomId);
    return row?.distribution_id ?? null;
  }

  reset(roomId) {
    this._del.run(roomId);
    const id = crypto.randomUUID();
    this._save.run(roomId, id);
    return id;
  }
}

// ---------------------------------------------------------------------------
// Protocol Store (aggregate)
// ---------------------------------------------------------------------------

class ProtocolStore {
  constructor(userId, masterKey) {
    this._db = openDatabase(userId);
    this._mk = masterKey;

    this.session = new SQLiteSessionStore(this._db, masterKey);
    this.identity = new SQLiteIdentityKeyStore(this._db, masterKey);
    this.preKey = new SQLitePreKeyStore(this._db, masterKey);
    this.signedPreKey = new SQLiteSignedPreKeyStore(this._db, masterKey);
    this.kyberPreKey = new SQLiteKyberPreKeyStore(this._db, masterKey);
    this.senderKey = new SQLiteSenderKeyStore(this._db, masterKey);
    this.roomDistribution = new RoomDistributionMap(this._db);
  }

  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    // Zero master key
    if (this._mk) {
      this._mk.fill(0);
      this._mk = null;
    }
  }
}

      return ProtocolStore;
    })();
  }

  return protocolStoreClassPromise;
}

async function createProtocolStore(userId, masterKey) {
  const ProtocolStore = await getProtocolStoreClass();
  return new ProtocolStore(userId, masterKey);
}

module.exports = { createProtocolStore };

