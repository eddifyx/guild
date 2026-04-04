import test from 'node:test';
import assert from 'node:assert/strict';

import { createLegacySessionRuntime } from '../../../client/src/features/crypto/legacySessionRuntime.mjs';

function createRuntime(overrides = {}) {
  const calls = [];
  const keyStore = {
    hasSession: async (...args) => {
      calls.push(['has-session', ...args]);
      return false;
    },
    getSession: async (...args) => {
      calls.push(['get-session', ...args]);
      return { id: 'session-1' };
    },
    saveSession: async (...args) => {
      calls.push(['save-session', ...args]);
    },
  };

  const runtime = createLegacySessionRuntime({
    sessionLocks: new Map(),
    isV1StoreReadyFn: () => true,
    getKeyStoreFn: () => keyStore,
    processX3DHInitMessageFn: async (_keyStore, x3dhHeader) => {
      calls.push(['process-x3dh', x3dhHeader]);
      return {
        sharedSecret: new Uint8Array(32).fill(9),
        signedPreKeyPair: { privateKey: new Uint8Array([1]), publicKey: new Uint8Array([2]) },
      };
    },
    initializeSessionAsBobFn: (sharedSecret, signedPreKeyPair) => {
      calls.push([
        'init-bob',
        new Uint8Array(sharedSecret),
        {
          privateKey: new Uint8Array(signedPreKeyPair.privateKey),
          publicKey: new Uint8Array(signedPreKeyPair.publicKey),
        },
      ]);
      return { id: 'fresh-session' };
    },
    ratchetDecryptFn: (...args) => {
      calls.push(['ratchet-decrypt', ...args]);
      return { plaintext: new Uint8Array([1, 2, 3]), state: { id: 'updated-session' } };
    },
    getCurrentUserIdFn: () => 'self-user',
    ...overrides,
  });

  return { runtime, calls, keyStore };
}

test('legacy session runtime rejects decrypt when the v1 store is unavailable', async () => {
  const { runtime } = createRuntime({
    isV1StoreReadyFn: () => false,
  });

  await assert.rejects(
    () => runtime.decryptV1Message('peer-1', {}, new Uint8Array(), new Uint8Array()),
    /V1 key store not available/,
  );
});

test('legacy session runtime bootstraps a missing v1 session from x3dh and persists the updated ratchet state', async () => {
  const { runtime, calls } = createRuntime();

  const plaintext = await runtime.decryptV1Message(
    'peer-1',
    { dh: 'dh', pn: 0, n: 0 },
    new Uint8Array([4]),
    new Uint8Array([5]),
    { init: true },
  );

  assert.deepEqual(Array.from(plaintext), [1, 2, 3]);
  assert.deepEqual(calls, [
    ['has-session', 'peer-1'],
    ['process-x3dh', { init: true }],
    ['init-bob', new Uint8Array(32).fill(9), { privateKey: new Uint8Array([1]), publicKey: new Uint8Array([2]) }],
    ['save-session', 'peer-1', { id: 'fresh-session' }],
    ['get-session', 'peer-1'],
    ['ratchet-decrypt', { id: 'session-1' }, { dh: 'dh', pn: 0, n: 0 }, new Uint8Array([4]), new Uint8Array([5]), 'peer-1', 'self-user'],
    ['save-session', 'peer-1', { id: 'updated-session' }],
  ]);
});

test('legacy session runtime retries decrypt with a fresh x3dh session after a ratchet failure', async () => {
  const { calls, runtime } = createRuntime({
    ratchetDecryptFn: (() => {
      let first = true;
      return (...args) => {
        calls.push(['ratchet-decrypt', ...args]);
        if (first) {
          first = false;
          throw new Error('decrypt failed');
        }
        return { plaintext: new Uint8Array([7]), state: { id: 'recovered-session' } };
      };
    })(),
  });

  const plaintext = await runtime.decryptV1Message(
    'peer-2',
    { dh: 'dh2', pn: 1, n: 2 },
    new Uint8Array([8]),
    new Uint8Array([9]),
    { init: 'retry' },
  );

  assert.deepEqual(Array.from(plaintext), [7]);
  assert.equal(calls.filter(([name]) => name === 'process-x3dh').length, 2);
  assert.deepEqual(calls.at(-1), ['save-session', 'peer-2', { id: 'recovered-session' }]);
});
