import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptStoredKeyValue,
  encryptStoredKeyValue,
  idbClearStore,
  idbDelete,
  idbGet,
  idbGetAll,
  idbGetAllKeys,
  idbPut,
  KEY_STORE_DB_NAME,
  KEY_STORE_DB_VERSION,
  KEY_STORE_STORES,
  openKeyStoreDb,
} from '../../../client/src/features/crypto/keyStoreDbRuntime.mjs';

function createIndexedDbRequest(result) {
  const request = { result, error: null };
  queueMicrotask(() => {
    request.onupgradeneeded?.({ target: { result } });
    request.onsuccess?.();
  });
  return request;
}

function createFakeDb(initialStore = new Map()) {
  const stores = new Map([
    ['identity', new Map(initialStore)],
  ]);
  const objectStoreNames = {
    contains(name) {
      return stores.has(name);
    },
  };

  return {
    objectStoreNames,
    createObjectStore(name) {
      stores.set(name, new Map());
    },
    transaction(storeName) {
      const store = stores.get(storeName) || new Map();
      stores.set(storeName, store);
      const tx = {
        error: null,
        objectStore() {
          return {
            get(key) {
              const request = { result: store.get(key) ?? null, error: null };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            put(value, key) {
              store.set(key, value);
              queueMicrotask(() => tx.oncomplete?.());
            },
            delete(key) {
              store.delete(key);
              queueMicrotask(() => tx.oncomplete?.());
            },
            getAll() {
              const request = { result: Array.from(store.values()), error: null };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            getAllKeys() {
              const request = { result: Array.from(store.keys()), error: null };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            clear() {
              store.clear();
              queueMicrotask(() => tx.oncomplete?.());
            },
          };
        },
      };
      return tx;
    },
  };
}

test('key store db runtime opens the canonical IndexedDB stores on upgrade', async () => {
  const db = createFakeDb();
  const indexedDb = {
    open(name, version) {
      assert.equal(name, KEY_STORE_DB_NAME);
      assert.equal(version, KEY_STORE_DB_VERSION);
      return createIndexedDbRequest(db);
    },
  };

  const opened = await openKeyStoreDb(indexedDb);
  assert.equal(opened, db);
  for (const storeName of KEY_STORE_STORES) {
    assert.equal(db.objectStoreNames.contains(storeName), true);
  }
});

test('key store db runtime performs canonical get/put/delete/getAll/getAllKeys/clear operations', async () => {
  const db = createFakeDb();

  await idbPut(db, 'identity', 'self', { value: 1 });
  await idbPut(db, 'identity', 'other', { value: 2 });
  assert.deepEqual(await idbGet(db, 'identity', 'self'), { value: 1 });
  assert.deepEqual(await idbGetAll(db, 'identity'), [{ value: 1 }, { value: 2 }]);
  assert.deepEqual(await idbGetAllKeys(db, 'identity'), ['self', 'other']);

  await idbDelete(db, 'identity', 'self');
  assert.equal(await idbGet(db, 'identity', 'self'), null);

  await idbClearStore(db, 'identity');
  assert.deepEqual(await idbGetAllKeys(db, 'identity'), []);
});

test('key store db runtime encrypts and decrypts values bound to their store and key slot', () => {
  const masterKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const encrypted = encryptStoredKeyValue({
    masterKey,
    value: { hello: 'guild' },
    storeName: 'sessions',
    key: 'user-1',
  });

  assert.deepEqual(
    decryptStoredKeyValue({
      masterKey,
      encrypted,
      storeName: 'sessions',
      key: 'user-1',
    }),
    { hello: 'guild' },
  );

  assert.throws(
    () => decryptStoredKeyValue({
      masterKey,
      encrypted,
      storeName: 'sessions',
      key: 'user-2',
    }),
    (error) => typeof error?.message === 'string' && error.message.length > 0,
  );
});
