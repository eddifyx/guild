export function selectMaxNumericKey(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) return 0;
  let max = keys[0];
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index] > max) max = keys[index];
  }
  return max;
}

export function selectLatestNumericKey(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  let maxKeyId = keys[0];
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index] > maxKeyId) maxKeyId = keys[index];
  }
  return maxKeyId;
}

export function selectKeysToPrune(keys = [], keepCount = 2) {
  if (!Array.isArray(keys) || keys.length <= keepCount) return [];
  const sorted = [...keys].sort((left, right) => left - right);
  return sorted.slice(0, sorted.length - keepCount);
}

export function buildSenderKeyStorageKey(groupId, senderUserId) {
  return `${groupId}:${senderUserId}`;
}

export function selectSenderKeysForGroup(keys = [], groupId) {
  const prefix = `${groupId}:`;
  return keys.filter((key) => typeof key === 'string' && key.startsWith(prefix));
}

export function getIdentityTrustStatus({
  storedIdentity = null,
  identityKeyPublicBase64,
  fromBase64Fn,
  constantTimeEqualFn,
} = {}) {
  if (!storedIdentity) return 'new';
  const storedBytes = fromBase64Fn(storedIdentity.identityKeyPublic);
  const incomingBytes = fromBase64Fn(identityKeyPublicBase64);
  if (constantTimeEqualFn(storedBytes, incomingBytes)) return 'trusted';
  return 'key_changed';
}

export function buildTofuTrustRecord({
  existing = null,
  identityKeyPublicBase64,
  nowMs = Date.now(),
  verified = false,
} = {}) {
  return {
    identityKeyPublic: identityKeyPublicBase64,
    firstSeen: existing?.firstSeen ?? nowMs,
    verified,
  };
}

export async function runEncryptedBatchPut({
  db,
  storeName,
  values = [],
  getKeyFn = (value) => value?.keyId,
  encryptValueFn = () => null,
} = {}) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const value of values) {
      const key = getKeyFn(value);
      store.put(encryptValueFn(value, key), key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function runBatchDelete({
  db,
  storeName,
  keys = [],
} = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const key of keys) {
      store.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearKeyStoreStores({
  stores = [],
  clearStoreFn = async () => {},
} = {}) {
  for (const storeName of stores) {
    await clearStoreFn(storeName);
  }
}
