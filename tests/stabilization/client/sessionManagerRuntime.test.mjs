import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionManagerRuntime,
  removeLegacyV1MasterKey,
} from '../../../client/src/features/crypto/sessionManagerRuntime.mjs';

test('session manager runtime coalesces concurrent init for the same user and marks E2E ready', async () => {
  const calls = [];
  const state = {
    initialized: false,
    e2eExpected: false,
    userId: null,
    initPromise: null,
    v1StoreReady: false,
    lifecycleVersion: 0,
  };
  let resolveInit;
  const gate = new Promise((resolve) => {
    resolveInit = resolve;
  });

  const runtime = createSessionManagerRuntime({
    state,
    initializeSignalCryptoFn: async (authData) => {
      calls.push(['init-signal', authData.userId]);
      await gate;
    },
    destroySignalCryptoFn: async () => {
      calls.push(['destroy-signal']);
    },
  });

  const first = runtime.initializeCryptoIdentity({ userId: 'user-1' });
  const second = runtime.initializeCryptoIdentity({ userId: 'user-1' });
  resolveInit();
  await Promise.all([first, second]);

  assert.deepEqual(calls, [['init-signal', 'user-1']]);
  assert.equal(runtime.isE2EInitialized(), true);
  assert.equal(runtime.wasE2EExpected(), false);
  assert.equal(runtime.getCurrentUserId(), 'user-1');
});

test('session manager runtime initializes the v1 store only when a legacy master key exists', async () => {
  const calls = [];
  const masterKey = new Uint8Array(32).fill(7);
  const state = {
    initialized: false,
    e2eExpected: false,
    userId: null,
    initPromise: null,
    v1StoreReady: false,
    lifecycleVersion: 0,
  };

  const runtime = createSessionManagerRuntime({
    state,
    initializeSignalCryptoFn: async () => {
      calls.push(['init-signal']);
    },
    getKeyStoreFn: () => ({
      initialize: async (key) => {
        calls.push(['init-v1-store', Array.from(key)]);
      },
    }),
    loadExistingV1MasterKeyFn: async (userId) => {
      calls.push(['load-legacy-key', userId]);
      return masterKey;
    },
  });

  await runtime.initializeCryptoIdentity({ userId: 'user-2' });

  assert.equal(runtime.isV1StoreReady(), true);
  assert.deepEqual(calls, [
    ['init-signal'],
    ['load-legacy-key', 'user-2'],
    ['init-v1-store', Array(32).fill(7)],
  ]);
  assert.deepEqual(Array.from(masterKey), Array(32).fill(0));
});

test('session manager runtime destroy resets flags, clears locks, and tears down crypto state', async () => {
  const calls = [];
  const state = {
    initialized: true,
    e2eExpected: true,
    userId: 'user-3',
    initPromise: Promise.resolve(),
    v1StoreReady: true,
    lifecycleVersion: 4,
  };

  const runtime = createSessionManagerRuntime({
    state,
    destroySignalCryptoFn: async () => {
      calls.push(['destroy-signal']);
    },
    resetKeyStoreFn: () => {
      calls.push(['reset-key-store']);
    },
    clearSessionLocksFn: () => {
      calls.push(['clear-locks']);
    },
  });

  await runtime.destroyCryptoState();

  assert.deepEqual(calls, [
    ['clear-locks'],
    ['destroy-signal'],
    ['reset-key-store'],
  ]);
  assert.equal(runtime.isE2EInitialized(), false);
  assert.equal(runtime.wasE2EExpected(), false);
  assert.equal(runtime.getCurrentUserId(), null);
  assert.equal(runtime.isV1StoreReady(), false);
  assert.equal(state.lifecycleVersion, 5);
});

test('removeLegacyV1MasterKey clears the legacy storage slot and never returns a key', () => {
  const removed = [];
  const storage = {
    removeItem: (key) => removed.push(key),
  };

  const result = removeLegacyV1MasterKey('user-4', storage);

  assert.equal(result, null);
  assert.deepEqual(removed, ['byzantine-mk-user-4']);
});
