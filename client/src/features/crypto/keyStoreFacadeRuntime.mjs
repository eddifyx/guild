import {
  buildSenderKeyStorageKey,
  buildTofuTrustRecord,
  clearKeyStoreStores,
  getIdentityTrustStatus,
  runBatchDelete,
  runEncryptedBatchPut,
  selectKeysToPrune,
  selectLatestNumericKey,
  selectMaxNumericKey,
  selectSenderKeysForGroup,
} from './keyStoreRuntime.mjs';
import {
  decryptStoredKeyValue,
  encryptStoredKeyValue,
  idbClearStore,
  idbDelete,
  idbGet,
  idbGetAllKeys,
  idbPut,
  KEY_STORE_STORES,
} from './keyStoreDbRuntime.mjs';
import {
  constantTimeEqual,
  fromBase64,
} from '../../crypto/primitives.js';

function getStoreState(context = {}) {
  if (!context.db || !context.masterKey) {
    throw new Error('KeyStore not initialized');
  }
  return context;
}

async function readEncryptedValue({ context, storeName, key }) {
  const { db, masterKey } = getStoreState(context);
  const encrypted = await idbGet(db, storeName, key);
  if (!encrypted) return null;
  return decryptStoredKeyValue({
    masterKey,
    encrypted,
    storeName,
    key,
  });
}

async function writeEncryptedValue({ context, storeName, key, value }) {
  const { db, masterKey } = getStoreState(context);
  const encrypted = encryptStoredKeyValue({
    masterKey,
    value,
    storeName,
    key,
  });
  await idbPut(db, storeName, key, encrypted);
}

export function createKeyStoreFacadeRuntime(context = {}) {
  return {
    state: context,

    async saveIdentityKeyPair(identityData) {
      await writeEncryptedValue({
        context,
        storeName: 'identity',
        key: 'self',
        value: identityData,
      });
    },

    async getIdentityKeyPair() {
      return readEncryptedValue({
        context,
        storeName: 'identity',
        key: 'self',
      });
    },

    async saveSignedPreKey(signedPreKey) {
      await writeEncryptedValue({
        context,
        storeName: 'signedPreKeys',
        key: signedPreKey.keyId,
        value: signedPreKey,
      });
    },

    async getSignedPreKey(keyId) {
      return readEncryptedValue({
        context,
        storeName: 'signedPreKeys',
        key: keyId,
      });
    },

    async getLatestSignedPreKey() {
      const { db } = getStoreState(context);
      const keys = await idbGetAllKeys(db, 'signedPreKeys');
      const maxKeyId = selectLatestNumericKey(keys);
      if (maxKeyId === null) return null;
      return this.getSignedPreKey(maxKeyId);
    },

    async pruneOldSignedPreKeys(keepCount = 2) {
      const { db } = getStoreState(context);
      const keys = await idbGetAllKeys(db, 'signedPreKeys');
      const toDelete = selectKeysToPrune(keys, keepCount);
      for (const keyId of toDelete) {
        await idbDelete(db, 'signedPreKeys', keyId);
      }
    },

    async saveOneTimePreKeys(preKeys) {
      const { db, masterKey } = getStoreState(context);
      await runEncryptedBatchPut({
        db,
        storeName: 'oneTimePreKeys',
        values: preKeys,
        getKeyFn: (preKey) => preKey.keyId,
        encryptValueFn: (preKey, key) => encryptStoredKeyValue({
          masterKey,
          value: preKey,
          storeName: 'oneTimePreKeys',
          key,
        }),
      });
    },

    async getOneTimePreKey(keyId) {
      return readEncryptedValue({
        context,
        storeName: 'oneTimePreKeys',
        key: keyId,
      });
    },

    async markOneTimePreKeyUsed(keyId) {
      const { db } = getStoreState(context);
      await idbDelete(db, 'oneTimePreKeys', keyId);
    },

    async getMaxOTPKeyId() {
      const { db } = getStoreState(context);
      const keys = await idbGetAllKeys(db, 'oneTimePreKeys');
      return selectMaxNumericKey(keys);
    },

    async saveSession(userId, sessionState) {
      await writeEncryptedValue({
        context,
        storeName: 'sessions',
        key: userId,
        value: sessionState,
      });
    },

    async getSession(userId) {
      return readEncryptedValue({
        context,
        storeName: 'sessions',
        key: userId,
      });
    },

    async hasSession(userId) {
      const { db } = getStoreState(context);
      const encrypted = await idbGet(db, 'sessions', userId);
      return encrypted !== null;
    },

    async deleteSession(userId) {
      const { db } = getStoreState(context);
      await idbDelete(db, 'sessions', userId);
    },

    async saveSenderKey(groupId, senderUserId, senderKeyState) {
      const key = buildSenderKeyStorageKey(groupId, senderUserId);
      await writeEncryptedValue({
        context,
        storeName: 'senderKeys',
        key,
        value: senderKeyState,
      });
    },

    async getSenderKey(groupId, senderUserId) {
      const key = buildSenderKeyStorageKey(groupId, senderUserId);
      return readEncryptedValue({
        context,
        storeName: 'senderKeys',
        key,
      });
    },

    async deleteSenderKeysForGroup(groupId) {
      const { db } = getStoreState(context);
      const keys = await idbGetAllKeys(db, 'senderKeys');
      await runBatchDelete({
        db,
        storeName: 'senderKeys',
        keys: selectSenderKeysForGroup(keys, groupId),
      });
    },

    async saveTrustedIdentity(userId, identityData) {
      await writeEncryptedValue({
        context,
        storeName: 'trustedIdentities',
        key: userId,
        value: identityData,
      });
    },

    async getTrustedIdentity(userId) {
      return readEncryptedValue({
        context,
        storeName: 'trustedIdentities',
        key: userId,
      });
    },

    async checkIdentityTrust(userId, identityKeyPublicBase64) {
      const stored = await this.getTrustedIdentity(userId);
      return getIdentityTrustStatus({
        storedIdentity: stored,
        identityKeyPublicBase64,
        fromBase64Fn: fromBase64,
        constantTimeEqualFn: constantTimeEqual,
      });
    },

    async tofuVerify(userId, identityKeyPublicBase64) {
      const status = await this.checkIdentityTrust(userId, identityKeyPublicBase64);

      if (status === 'new') {
        await this.saveTrustedIdentity(userId, buildTofuTrustRecord({
          identityKeyPublicBase64,
          nowMs: Date.now(),
          verified: false,
        }));
        return { trusted: true, keyChanged: false };
      }

      if (status === 'trusted') {
        return { trusted: true, keyChanged: false };
      }

      return { trusted: false, keyChanged: true };
    },

    async markVerified(userId, identityKeyPublicBase64) {
      const existing = await this.getTrustedIdentity(userId);
      await this.saveTrustedIdentity(userId, buildTofuTrustRecord({
        existing,
        identityKeyPublicBase64,
        nowMs: Date.now(),
        verified: true,
      }));
    },

    async clear() {
      const { db } = getStoreState(context);
      await clearKeyStoreStores({
        stores: KEY_STORE_STORES,
        clearStoreFn: (storeName) => idbClearStore(db, storeName),
      });
    },
  };
}
