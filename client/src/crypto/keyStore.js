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
  randomBytes,
} from './primitives.js';
import { createKeyStoreFacadeRuntime } from '../features/crypto/keyStoreFacadeRuntime.mjs';
import { openKeyStoreDb } from '../features/crypto/keyStoreDbRuntime.mjs';

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
    this._runtime = createKeyStoreFacadeRuntime({
      db: this._db,
      masterKey: this._masterKey,
    });
  }

  /**
   * Initialize the key store with a master encryption key.
   * Must be called before any other operation.
   */
  async initialize(masterKey) {
    this._masterKey = new Uint8Array(masterKey);
    this._db = await openKeyStoreDb();
    this._runtime.state.db = this._db;
    this._runtime.state.masterKey = this._masterKey;
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
    this._runtime.state.db = this._db;
    this._runtime.state.masterKey = this._masterKey;
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
    await this._runtime.saveIdentityKeyPair(identityData);
  }

  async getIdentityKeyPair() {
    this._ensureOpen();
    return this._runtime.getIdentityKeyPair();
  }

  // -------------------------------------------------------------------------
  // Signed PreKeys
  // -------------------------------------------------------------------------

  async saveSignedPreKey(signedPreKey) {
    this._ensureOpen();
    await this._runtime.saveSignedPreKey(signedPreKey);
  }

  async getSignedPreKey(keyId) {
    this._ensureOpen();
    return this._runtime.getSignedPreKey(keyId);
  }

  async getLatestSignedPreKey() {
    this._ensureOpen();
    return this._runtime.getLatestSignedPreKey();
  }

  /**
   * Delete old signed prekeys, keeping the latest N.
   * Called after rotation to prevent unbounded accumulation.
   */
  async pruneOldSignedPreKeys(keepCount = 2) {
    this._ensureOpen();
    await this._runtime.pruneOldSignedPreKeys(keepCount);
  }

  // -------------------------------------------------------------------------
  // One-Time PreKeys
  // -------------------------------------------------------------------------

  async saveOneTimePreKeys(preKeys) {
    this._ensureOpen();
    await this._runtime.saveOneTimePreKeys(preKeys);
  }

  async getOneTimePreKey(keyId) {
    this._ensureOpen();
    return this._runtime.getOneTimePreKey(keyId);
  }

  async markOneTimePreKeyUsed(keyId) {
    this._ensureOpen();
    await this._runtime.markOneTimePreKeyUsed(keyId);
  }

  async getMaxOTPKeyId() {
    this._ensureOpen();
    return this._runtime.getMaxOTPKeyId();
  }

  // -------------------------------------------------------------------------
  // Sessions (Double Ratchet state per recipient)
  // -------------------------------------------------------------------------

  async saveSession(userId, sessionState) {
    this._ensureOpen();
    await this._runtime.saveSession(userId, sessionState);
  }

  async getSession(userId) {
    this._ensureOpen();
    return this._runtime.getSession(userId);
  }

  async hasSession(userId) {
    this._ensureOpen();
    return this._runtime.hasSession(userId);
  }

  async deleteSession(userId) {
    this._ensureOpen();
    await this._runtime.deleteSession(userId);
  }

  // -------------------------------------------------------------------------
  // Sender Keys (for group/room encryption)
  // -------------------------------------------------------------------------

  async saveSenderKey(groupId, senderUserId, senderKeyState) {
    this._ensureOpen();
    await this._runtime.saveSenderKey(groupId, senderUserId, senderKeyState);
  }

  async getSenderKey(groupId, senderUserId) {
    this._ensureOpen();
    return this._runtime.getSenderKey(groupId, senderUserId);
  }

  async deleteSenderKeysForGroup(groupId) {
    this._ensureOpen();
    await this._runtime.deleteSenderKeysForGroup(groupId);
  }

  // -------------------------------------------------------------------------
  // Trusted Identities (TOFU — Trust On First Use)
  // -------------------------------------------------------------------------

  async saveTrustedIdentity(userId, identityData) {
    this._ensureOpen();
    await this._runtime.saveTrustedIdentity(userId, identityData);
  }

  async getTrustedIdentity(userId) {
    this._ensureOpen();
    return this._runtime.getTrustedIdentity(userId);
  }

  /**
   * Check trust status of a user's identity key.
   * @param {string} userId
   * @param {string} identityKeyPublicBase64
   * @returns {'trusted' | 'new' | 'key_changed'}
   */
  async checkIdentityTrust(userId, identityKeyPublicBase64) {
    this._ensureOpen();
    return this._runtime.checkIdentityTrust(userId, identityKeyPublicBase64);
  }

  /**
   * Trust On First Use: store identity key if new, warn if changed.
   * @returns {{ trusted: boolean, keyChanged: boolean }}
   */
  async tofuVerify(userId, identityKeyPublicBase64) {
    this._ensureOpen();
    return this._runtime.tofuVerify(userId, identityKeyPublicBase64);
  }

  /**
   * Manually verify (or re-trust) a user's identity after safety number comparison.
   */
  async markVerified(userId, identityKeyPublicBase64) {
    this._ensureOpen();
    await this._runtime.markVerified(userId, identityKeyPublicBase64);
  }

  // -------------------------------------------------------------------------
  // Clear all data (for account deletion / reset)
  // -------------------------------------------------------------------------

  async clear() {
    this._ensureOpen();
    await this._runtime.clear();
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
