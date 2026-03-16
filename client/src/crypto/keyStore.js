/**
 * /guild E2E Encryption — Encrypted Key Store
 *
 * Persistent, encrypted key storage using IndexedDB.
 * All values are AES-256-GCM encrypted with a master key before writing.
 *
 * Master key derivation:
 *   - Legacy v1 store only: caller provides a random 32-byte master key
 *
 * IndexedDB is used instead of localStorage because:
 *   - Handles binary blobs efficiently
 *   - Not trivially visible in dev tools string dumps
 *   - Larger storage quota
 */

import {
  aes256GcmEncrypt,
  aes256GcmDecrypt,
  hkdfSha256,
  randomBytes,
  constantTimeEqual,
  concatBytes,
  toBase64,
  fromBase64,
} from './primitives.js';

const DB_NAME = 'byzantine-keystore';
const DB_VERSION = 1;

const STORES = [
  'identity',
  'signedPreKeys',
  'oneTimePreKeys',
  'sessions',
  'senderKeys',
  'trustedIdentities',
];

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllKeys(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbClearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt a value for storage. The storeName and key are bound as AAD
 * so ciphertext cannot be relocated to a different store/key slot.
 */
function encryptValue(masterKey, value, storeName, key) {
  const json = JSON.stringify(value);
  const plaintext = new TextEncoder().encode(json);
  const aad = new TextEncoder().encode(`${storeName}:${key}`);
  const { ciphertext, nonce } = aes256GcmEncrypt(masterKey, plaintext, aad);
  return { ct: toBase64(ciphertext), nc: toBase64(nonce) };
}

function decryptValue(masterKey, encrypted, storeName, key) {
  const ciphertext = fromBase64(encrypted.ct);
  const nonce = fromBase64(encrypted.nc);
  const aad = new TextEncoder().encode(`${storeName}:${key}`);
  const plaintext = aes256GcmDecrypt(masterKey, ciphertext, nonce, aad);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Master Key Derivation
// ---------------------------------------------------------------------------

/**
 * Generate a random master key for the legacy v1 store.
 * The caller is responsible for deciding whether to persist it.
 */
export function generateRandomMasterKey() {
  return randomBytes(32);
}

// ---------------------------------------------------------------------------
// KeyStore class
// ---------------------------------------------------------------------------

export class KeyStore {
  constructor() {
    this._db = null;
    this._masterKey = null;
  }

  /**
   * Initialize the key store with a master encryption key.
   * Must be called before any other operation.
   */
  async initialize(masterKey) {
    this._masterKey = new Uint8Array(masterKey);
    this._db = await openDB();
  }

  /**
   * Close the key store. Wipes the master key from memory.
   */
  close() {
    if (this._masterKey) {
      this._masterKey.fill(0);
      this._masterKey = null;
    }
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  _ensureOpen() {
    if (!this._db || !this._masterKey) {
      throw new Error('KeyStore not initialized');
    }
  }

  // -------------------------------------------------------------------------
  // Identity Keys
  // -------------------------------------------------------------------------

  async saveIdentityKeyPair(identityData) {
    this._ensureOpen();
    const encrypted = encryptValue(this._masterKey, identityData, 'identity', 'self');
    await idbPut(this._db, 'identity', 'self', encrypted);
  }

  async getIdentityKeyPair() {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'identity', 'self');
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'identity', 'self');
  }

  // -------------------------------------------------------------------------
  // Signed PreKeys
  // -------------------------------------------------------------------------

  async saveSignedPreKey(signedPreKey) {
    this._ensureOpen();
    const encrypted = encryptValue(this._masterKey, signedPreKey, 'signedPreKeys', signedPreKey.keyId);
    await idbPut(this._db, 'signedPreKeys', signedPreKey.keyId, encrypted);
  }

  async getSignedPreKey(keyId) {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'signedPreKeys', keyId);
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'signedPreKeys', keyId);
  }

  async getLatestSignedPreKey() {
    this._ensureOpen();
    const keys = await idbGetAllKeys(this._db, 'signedPreKeys');
    if (keys.length === 0) return null;
    let maxKeyId = keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (keys[i] > maxKeyId) maxKeyId = keys[i];
    }
    return this.getSignedPreKey(maxKeyId);
  }

  /**
   * Delete old signed prekeys, keeping the latest N.
   * Called after rotation to prevent unbounded accumulation.
   */
  async pruneOldSignedPreKeys(keepCount = 2) {
    this._ensureOpen();
    const keys = await idbGetAllKeys(this._db, 'signedPreKeys');
    if (keys.length <= keepCount) return;
    // Sort ascending so we delete the oldest
    const sorted = [...keys].sort((a, b) => a - b);
    const toDelete = sorted.slice(0, sorted.length - keepCount);
    for (const keyId of toDelete) {
      await idbDelete(this._db, 'signedPreKeys', keyId);
    }
  }

  // -------------------------------------------------------------------------
  // One-Time PreKeys
  // -------------------------------------------------------------------------

  async saveOneTimePreKeys(preKeys) {
    this._ensureOpen();
    // Use a single transaction for atomicity — all-or-nothing
    await new Promise((resolve, reject) => {
      const tx = this._db.transaction('oneTimePreKeys', 'readwrite');
      const store = tx.objectStore('oneTimePreKeys');
      for (const pk of preKeys) {
        const encrypted = encryptValue(this._masterKey, pk, 'oneTimePreKeys', pk.keyId);
        store.put(encrypted, pk.keyId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async getOneTimePreKey(keyId) {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'oneTimePreKeys', keyId);
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'oneTimePreKeys', keyId);
  }

  async markOneTimePreKeyUsed(keyId) {
    this._ensureOpen();
    await idbDelete(this._db, 'oneTimePreKeys', keyId);
  }

  async getMaxOTPKeyId() {
    this._ensureOpen();
    const keys = await idbGetAllKeys(this._db, 'oneTimePreKeys');
    if (keys.length === 0) return 0;
    let max = keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (keys[i] > max) max = keys[i];
    }
    return max;
  }

  // -------------------------------------------------------------------------
  // Sessions (Double Ratchet state per recipient)
  // -------------------------------------------------------------------------

  async saveSession(userId, sessionState) {
    this._ensureOpen();
    const encrypted = encryptValue(this._masterKey, sessionState, 'sessions', userId);
    await idbPut(this._db, 'sessions', userId, encrypted);
  }

  async getSession(userId) {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'sessions', userId);
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'sessions', userId);
  }

  async hasSession(userId) {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'sessions', userId);
    return encrypted !== null;
  }

  async deleteSession(userId) {
    this._ensureOpen();
    await idbDelete(this._db, 'sessions', userId);
  }

  // -------------------------------------------------------------------------
  // Sender Keys (for group/room encryption)
  // -------------------------------------------------------------------------

  async saveSenderKey(groupId, senderUserId, senderKeyState) {
    this._ensureOpen();
    const key = `${groupId}:${senderUserId}`;
    const encrypted = encryptValue(this._masterKey, senderKeyState, 'senderKeys', key);
    await idbPut(this._db, 'senderKeys', key, encrypted);
  }

  async getSenderKey(groupId, senderUserId) {
    this._ensureOpen();
    const key = `${groupId}:${senderUserId}`;
    const encrypted = await idbGet(this._db, 'senderKeys', key);
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'senderKeys', key);
  }

  async deleteSenderKeysForGroup(groupId) {
    this._ensureOpen();
    const keys = await idbGetAllKeys(this._db, 'senderKeys');
    const prefix = groupId + ':';
    const toDelete = keys.filter(k => typeof k === 'string' && k.startsWith(prefix));
    if (toDelete.length === 0) return;
    // Use a single transaction for atomicity
    await new Promise((resolve, reject) => {
      const tx = this._db.transaction('senderKeys', 'readwrite');
      const store = tx.objectStore('senderKeys');
      for (const key of toDelete) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // -------------------------------------------------------------------------
  // Trusted Identities (TOFU — Trust On First Use)
  // -------------------------------------------------------------------------

  async saveTrustedIdentity(userId, identityData) {
    this._ensureOpen();
    const encrypted = encryptValue(this._masterKey, identityData, 'trustedIdentities', userId);
    await idbPut(this._db, 'trustedIdentities', userId, encrypted);
  }

  async getTrustedIdentity(userId) {
    this._ensureOpen();
    const encrypted = await idbGet(this._db, 'trustedIdentities', userId);
    if (!encrypted) return null;
    return decryptValue(this._masterKey, encrypted, 'trustedIdentities', userId);
  }

  /**
   * Check trust status of a user's identity key.
   * @param {string} userId
   * @param {string} identityKeyPublicBase64
   * @returns {'trusted' | 'new' | 'key_changed'}
   */
  async checkIdentityTrust(userId, identityKeyPublicBase64) {
    const stored = await this.getTrustedIdentity(userId);
    if (!stored) return 'new';
    // Use constant-time comparison to prevent timing side-channel
    const storedBytes = fromBase64(stored.identityKeyPublic);
    const incomingBytes = fromBase64(identityKeyPublicBase64);
    if (constantTimeEqual(storedBytes, incomingBytes)) return 'trusted';
    return 'key_changed';
  }

  /**
   * Trust On First Use: store identity key if new, warn if changed.
   * @returns {{ trusted: boolean, keyChanged: boolean }}
   */
  async tofuVerify(userId, identityKeyPublicBase64) {
    const status = await this.checkIdentityTrust(userId, identityKeyPublicBase64);

    if (status === 'new') {
      await this.saveTrustedIdentity(userId, {
        identityKeyPublic: identityKeyPublicBase64,
        firstSeen: Date.now(),
        verified: false,
      });
      return { trusted: true, keyChanged: false };
    }

    if (status === 'trusted') {
      return { trusted: true, keyChanged: false };
    }

    // key_changed — do NOT auto-trust, flag for user
    return { trusted: false, keyChanged: true };
  }

  /**
   * Manually verify (or re-trust) a user's identity after safety number comparison.
   */
  async markVerified(userId, identityKeyPublicBase64) {
    const existing = await this.getTrustedIdentity(userId);
    await this.saveTrustedIdentity(userId, {
      identityKeyPublic: identityKeyPublicBase64,
      firstSeen: existing?.firstSeen ?? Date.now(),
      verified: true,
    });
  }

  // -------------------------------------------------------------------------
  // Clear all data (for account deletion / reset)
  // -------------------------------------------------------------------------

  async clear() {
    this._ensureOpen();
    for (const storeName of STORES) {
      await idbClearStore(this._db, storeName);
    }
  }
}

// Singleton instance
let _instance = null;

export function getKeyStore() {
  if (!_instance) {
    _instance = new KeyStore();
  }
  return _instance;
}

/**
 * Reset the singleton instance (call on logout).
 * Prevents cross-user crypto state contamination when switching accounts.
 */
export function resetKeyStore() {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}
