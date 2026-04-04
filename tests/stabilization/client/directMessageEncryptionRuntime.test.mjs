import test from 'node:test';
import assert from 'node:assert/strict';

import { createDirectMessageEncryptionRuntime } from '../../../client/src/features/crypto/directMessageEncryptionRuntime.mjs';

test('direct message encryption runtime shapes DM payloads and stringifies the envelope', async () => {
  const calls = [];
  const runtime = createDirectMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    buildDirectMessageEnvelopeFn: async (...args) => {
      calls.push(args);
      return { v: 3, copies: [] };
    },
    nowFn: () => 1234,
  });

  const encrypted = await runtime.encryptDirectMessage('peer-1', 'hello', [{ id: 'att-1' }]);

  assert.equal(encrypted, JSON.stringify({ v: 3, copies: [] }));
  assert.deepEqual(calls, [[
    'peer-1',
    JSON.stringify({
      body: 'hello',
      attachments: [{ id: 'att-1' }],
      ts: 1234,
    }),
  ]]);
});

test('direct message encryption runtime decrypts the matching multi-copy DM for the current device', async () => {
  const calls = [];
  const runtime = createDirectMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    getSignalUserIdFn: () => 'self-1',
    getSignalDeviceIdFn: () => 7,
    signalDecryptFn: async (...args) => {
      calls.push(args);
      return JSON.stringify({ body: 'hi', attachments: [], ts: 55 });
    },
  });

  const decrypted = await runtime.decryptDirectMessage('peer-1', {
    v: 3,
    senderDeviceId: 9,
    copies: [
      { recipientUserId: 'self-1', recipientDeviceId: 2, type: 3, payload: 'old' },
      { recipientUserId: 'self-1', recipientDeviceId: 7, type: 3, payload: 'cipher' },
    ],
  });

  assert.deepEqual(decrypted, { body: 'hi', attachments: [], ts: 55 });
  assert.deepEqual(calls, [['peer-1', 9, 3, 'cipher']]);
});

test('direct message encryption runtime decrypts legacy v2 envelopes through the shared signal decrypt path', async () => {
  const calls = [];
  const runtime = createDirectMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    signalDecryptFn: async (...args) => {
      calls.push(args);
      return JSON.stringify({ body: 'legacy-v2', attachments: [], ts: 77 });
    },
  });

  const decrypted = await runtime.decryptDirectMessage('peer-2', {
    v: 2,
    type: 3,
    payload: 'payload-wire',
  });

  assert.deepEqual(decrypted, { body: 'legacy-v2', attachments: [], ts: 77 });
  assert.deepEqual(calls, [['peer-2', 1, 3, 'payload-wire']]);
});

test('direct message encryption runtime validates and decrypts legacy v1 envelopes', async () => {
  const calls = [];
  const plaintext = new TextEncoder().encode(JSON.stringify({
    body: 'legacy-v1',
    attachments: [{ id: 'att-2' }],
    ts: 99,
  }));
  const runtime = createDirectMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    isV1StoreReadyFn: () => true,
    fromBase64Fn: (value) => `decoded:${value}`,
    decryptV1MessageFn: async (...args) => {
      calls.push(args);
      return plaintext;
    },
  });

  const decrypted = await runtime.decryptDirectMessage('peer-3', {
    v: 1,
    type: 'x3dh_init',
    rh: { dh: 'dh-key', pn: 1, n: 2 },
    ct: 'ciphertext',
    nc: 'nonce',
    x3dh: { ik: 'identity' },
  });

  assert.deepEqual(decrypted, {
    body: 'legacy-v1',
    attachments: [{ id: 'att-2' }],
    ts: 99,
  });
  assert.deepEqual(calls, [[
    'peer-3',
    { dh: 'dh-key', pn: 1, n: 2 },
    'decoded:ciphertext',
    'decoded:nonce',
    { ik: 'identity' },
  ]]);
});

test('direct message encryption runtime rejects multi-copy envelopes when this device has no copy', async () => {
  const runtime = createDirectMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    getSignalUserIdFn: () => 'self-1',
    getSignalDeviceIdFn: () => 7,
  });

  await assert.rejects(
    runtime.decryptDirectMessage('peer-4', {
      v: 3,
      senderDeviceId: 4,
      copies: [
        { recipientUserId: 'self-1', recipientDeviceId: 2, type: 3, payload: 'old' },
      ],
    }),
    /No DM copy available for device 7/
  );
});
