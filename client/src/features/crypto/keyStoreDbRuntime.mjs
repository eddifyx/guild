import {
  aes256GcmDecrypt,
  aes256GcmEncrypt,
  fromBase64,
  toBase64,
} from '../../crypto/primitives.js';

export const KEY_STORE_DB_NAME = 'byzantine-keystore';
export const KEY_STORE_DB_VERSION = 1;
export const KEY_STORE_STORES = [
  'identity',
  'signedPreKeys',
  'oneTimePreKeys',
  'sessions',
  'senderKeys',
  'trustedIdentities',
];

export function openKeyStoreDb(indexedDb = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(KEY_STORE_DB_NAME, KEY_STORE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const storeName of KEY_STORE_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function idbPut(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbGetAllKeys(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbClearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function encryptStoredKeyValue({ masterKey, value, storeName, key }) {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const aad = new TextEncoder().encode(`${storeName}:${key}`);
  const { ciphertext, nonce } = aes256GcmEncrypt(masterKey, plaintext, aad);
  return {
    ct: toBase64(ciphertext),
    nc: toBase64(nonce),
  };
}

export function decryptStoredKeyValue({ masterKey, encrypted, storeName, key }) {
  const ciphertext = fromBase64(encrypted.ct);
  const nonce = fromBase64(encrypted.nc);
  const aad = new TextEncoder().encode(`${storeName}:${key}`);
  const plaintext = aes256GcmDecrypt(masterKey, ciphertext, nonce, aad);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
