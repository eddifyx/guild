import test from 'node:test';
import assert from 'node:assert/strict';

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
} from '../../../client/src/features/crypto/keyStoreRuntime.mjs';

test('key store runtime selects numeric keys and sender-key group prefixes canonically', () => {
  assert.equal(selectMaxNumericKey([]), 0);
  assert.equal(selectMaxNumericKey([4, 9, 2]), 9);
  assert.equal(selectLatestNumericKey([]), null);
  assert.equal(selectLatestNumericKey([3, 7, 5]), 7);
  assert.deepEqual(selectKeysToPrune([8, 2, 5, 1], 2), [1, 2]);
  assert.equal(buildSenderKeyStorageKey('room-1', 'user-1'), 'room-1:user-1');
  assert.deepEqual(
    selectSenderKeysForGroup(['room-1:user-1', 'room-1:user-2', 'room-2:user-1'], 'room-1'),
    ['room-1:user-1', 'room-1:user-2'],
  );
});

test('key store runtime evaluates trust and builds TOFU records consistently', () => {
  const fromBase64Fn = (value) => Uint8Array.from(value.split(',').map(Number));
  const constantTimeEqualFn = (left, right) => (
    left.length === right.length && left.every((value, index) => value === right[index])
  );

  assert.equal(getIdentityTrustStatus({
    storedIdentity: null,
    identityKeyPublicBase64: '1,2,3',
    fromBase64Fn,
    constantTimeEqualFn,
  }), 'new');

  assert.equal(getIdentityTrustStatus({
    storedIdentity: { identityKeyPublic: '1,2,3' },
    identityKeyPublicBase64: '1,2,3',
    fromBase64Fn,
    constantTimeEqualFn,
  }), 'trusted');

  assert.equal(getIdentityTrustStatus({
    storedIdentity: { identityKeyPublic: '1,2,3' },
    identityKeyPublicBase64: '9,9,9',
    fromBase64Fn,
    constantTimeEqualFn,
  }), 'key_changed');

  assert.deepEqual(buildTofuTrustRecord({
    identityKeyPublicBase64: '1,2,3',
    nowMs: 111,
    verified: false,
  }), {
    identityKeyPublic: '1,2,3',
    firstSeen: 111,
    verified: false,
  });

  assert.deepEqual(buildTofuTrustRecord({
    existing: { firstSeen: 42 },
    identityKeyPublicBase64: '4,5,6',
    nowMs: 999,
    verified: true,
  }), {
    identityKeyPublic: '4,5,6',
    firstSeen: 42,
    verified: true,
  });
});

test('key store runtime batches encrypted writes, deletes, and clears through one contract', async () => {
  const calls = [];
  const db = {
    transaction(storeName, mode) {
      calls.push(['transaction', storeName, mode]);
      const tx = {
        error: null,
        objectStore() {
          return {
            put(value, key) {
              calls.push(['put', key, value]);
            },
            delete(key) {
              calls.push(['delete', key]);
            },
          };
        },
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };

  await runEncryptedBatchPut({
    db,
    storeName: 'oneTimePreKeys',
    values: [{ keyId: 1 }, { keyId: 2 }],
    getKeyFn: (value) => value.keyId,
    encryptValueFn: (value, key) => ({ key, value }),
  });

  await runBatchDelete({
    db,
    storeName: 'senderKeys',
    keys: ['room-1:user-1', 'room-1:user-2'],
  });

  const cleared = [];
  await clearKeyStoreStores({
    stores: ['identity', 'sessions'],
    clearStoreFn: async (storeName) => {
      cleared.push(storeName);
    },
  });

  assert.deepEqual(calls, [
    ['transaction', 'oneTimePreKeys', 'readwrite'],
    ['put', 1, { key: 1, value: { keyId: 1 } }],
    ['put', 2, { key: 2, value: { keyId: 2 } }],
    ['transaction', 'senderKeys', 'readwrite'],
    ['delete', 'room-1:user-1'],
    ['delete', 'room-1:user-2'],
  ]);
  assert.deepEqual(cleared, ['identity', 'sessions']);
});
