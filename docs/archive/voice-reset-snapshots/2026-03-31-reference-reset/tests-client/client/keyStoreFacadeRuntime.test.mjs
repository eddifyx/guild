import test from 'node:test';
import assert from 'node:assert/strict';

import { createKeyStoreFacadeRuntime } from '../../../client/src/features/crypto/keyStoreFacadeRuntime.mjs';
import { KEY_STORE_STORES } from '../../../client/src/features/crypto/keyStoreDbRuntime.mjs';

function createFakeDb() {
  const stores = new Map(KEY_STORE_STORES.map((storeName) => [storeName, new Map()]));

  return {
    transaction(storeName) {
      const store = stores.get(storeName);
      if (!store) throw new Error(`Unknown store ${storeName}`);
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

test('key store facade runtime preserves encrypted slot, trust, and cleanup behavior', async () => {
  const context = {
    db: createFakeDb(),
    masterKey: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
  };
  const keyStore = createKeyStoreFacadeRuntime(context);

  await keyStore.saveIdentityKeyPair({
    identityKeyPrivate: 'id-private',
    identityKeyPublic: 'id-public',
    signingKeyPrivate: 'sig-private',
    signingKeyPublic: 'sig-public',
    registrationId: 42,
  });
  assert.deepEqual(await keyStore.getIdentityKeyPair(), {
    identityKeyPrivate: 'id-private',
    identityKeyPublic: 'id-public',
    signingKeyPrivate: 'sig-private',
    signingKeyPublic: 'sig-public',
    registrationId: 42,
  });

  await keyStore.saveSignedPreKey({ keyId: 7, payload: 'older' });
  await keyStore.saveSignedPreKey({ keyId: 9, payload: 'latest' });
  assert.deepEqual(await keyStore.getSignedPreKey(9), { keyId: 9, payload: 'latest' });
  assert.deepEqual(await keyStore.getLatestSignedPreKey(), { keyId: 9, payload: 'latest' });
  await keyStore.pruneOldSignedPreKeys(1);
  assert.equal(await keyStore.getSignedPreKey(7), null);

  await keyStore.saveOneTimePreKeys([
    { keyId: 11, payload: 'otp-11' },
    { keyId: 13, payload: 'otp-13' },
  ]);
  assert.equal(await keyStore.getMaxOTPKeyId(), 13);
  assert.deepEqual(await keyStore.getOneTimePreKey(13), { keyId: 13, payload: 'otp-13' });
  await keyStore.markOneTimePreKeyUsed(11);
  assert.equal(await keyStore.getOneTimePreKey(11), null);

  await keyStore.saveSession('user-1', { state: 'ratchet' });
  assert.equal(await keyStore.hasSession('user-1'), true);
  assert.deepEqual(await keyStore.getSession('user-1'), { state: 'ratchet' });
  await keyStore.deleteSession('user-1');
  assert.equal(await keyStore.hasSession('user-1'), false);

  await keyStore.saveSenderKey('room-1', 'alice', { senderKey: 'alpha' });
  await keyStore.saveSenderKey('room-1', 'bob', { senderKey: 'beta' });
  await keyStore.saveSenderKey('room-2', 'carol', { senderKey: 'gamma' });
  assert.deepEqual(await keyStore.getSenderKey('room-1', 'alice'), { senderKey: 'alpha' });
  await keyStore.deleteSenderKeysForGroup('room-1');
  assert.equal(await keyStore.getSenderKey('room-1', 'alice'), null);
  assert.deepEqual(await keyStore.getSenderKey('room-2', 'carol'), { senderKey: 'gamma' });

  assert.deepEqual(await keyStore.tofuVerify('user-2', 'AQID'), { trusted: true, keyChanged: false });
  assert.deepEqual(await keyStore.tofuVerify('user-2', 'AQID'), { trusted: true, keyChanged: false });
  assert.deepEqual(await keyStore.tofuVerify('user-2', 'CQkJ'), { trusted: false, keyChanged: true });
  await keyStore.markVerified('user-2', 'AQID');
  assert.equal(await keyStore.checkIdentityTrust('user-2', 'AQID'), 'trusted');

  await keyStore.clear();
  assert.equal(await keyStore.getIdentityKeyPair(), null);
  assert.equal(await keyStore.getSession('user-1'), null);
  assert.equal(await keyStore.getTrustedIdentity('user-2'), null);
});
