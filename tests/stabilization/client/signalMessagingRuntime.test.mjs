import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectMessageEnvelopeRuntime,
  createSignalSenderKeyDistributionMessage,
  decryptSignalGroupMessage,
  decryptSignalMessage,
  encryptSignalGroupMessage,
  encryptSignalMessage,
  ensureSignalMessageSession,
  rekeySignalRoom,
} from '../../../client/src/features/crypto/signalMessagingRuntime.mjs';

test('signal messaging runtime delegates verified session setup to the canonical session runtime', async () => {
  const calls = [];
  const sessionBootstrapRecipients = new Set();

  const result = await ensureSignalMessageSession({
    recipientId: 'user-1',
    recipientDeviceId: 2,
    currentUserId: 'self-1',
    sessionBootstrapRecipients,
    requireTrustedNpubFn: async () => calls.push('trust'),
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    hasSessionFn: async () => true,
    verifyAndApproveIdentityFn: async () => calls.push('verify'),
    fetchVerifiedIdentityFn: async () => calls.push('fetch-identity'),
    bootstrapSessionFromVerifiedBundleFn: async () => calls.push('bootstrap'),
  });

  assert.deepEqual(result, {
    bootstrapped: false,
    addressKey: 'user-1:2',
  });
  assert.deepEqual(calls, ['trust', 'fetch-identity']);
  assert.equal(sessionBootstrapRecipients.has('user-1:2'), true);
});

test('signal messaging runtime retries encrypt after refreshing the verified session bundle', async () => {
  const calls = [];
  const sessionBootstrapRecipients = new Set();
  let firstAttempt = true;

  const result = await encryptSignalMessage({
    recipientId: 'user-2',
    recipientDeviceId: 3,
    plaintext: 'hello guild',
    ensureOutboundSignalReadyFn: async () => calls.push('ready'),
    ensureSignalMessageSessionFn: async (userId, deviceId) => calls.push(['ensure', userId, deviceId]),
    encryptFn: async (userId, deviceId, plaintext) => {
      calls.push(['encrypt', userId, deviceId, plaintext]);
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error('stale session');
      }
      return { type: 3, payload: 'ciphertext' };
    },
    bootstrapSessionFromVerifiedBundleFn: async (userId, deviceId, options) => {
      calls.push(['bootstrap', userId, deviceId, options.force]);
    },
    sessionBootstrapRecipients,
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    logWarnFn: (...args) => calls.push(['warn', args[0]]),
  });

  assert.deepEqual(result, { type: 3, payload: 'ciphertext' });
  assert.deepEqual(calls, [
    'ready',
    ['ensure', 'user-2', 3],
    ['encrypt', 'user-2', 3, 'hello guild'],
    ['warn', '[Signal] Encrypt failed, refreshing session:'],
    ['bootstrap', 'user-2', 3, true],
    ['encrypt', 'user-2', 3, 'hello guild'],
  ]);
  assert.equal(sessionBootstrapRecipients.has('user-2:3'), true);
});

test('signal messaging runtime requires verified identity before decrypting pre-key messages', async () => {
  const calls = [];

  const result = await decryptSignalMessage({
    senderId: 'user-3',
    senderDeviceId: 4,
    type: 3,
    payload: 'ciphertext',
    requireTrustedNpubFn: async (userId, options) => calls.push(['trust', userId, options.quarantineSession]),
    fetchVerifiedIdentityFn: async (userId, deviceId) => calls.push(['fetch', userId, deviceId]),
    decryptFn: async (userId, deviceId, type, payload) => {
      calls.push(['decrypt', userId, deviceId, type, payload]);
      return 'plaintext';
    },
  });

  assert.equal(result, 'plaintext');
  assert.deepEqual(calls, [
    ['trust', 'user-3', true],
    ['fetch', 'user-3', 4],
    ['decrypt', 'user-3', 4, 3, 'ciphertext'],
  ]);
});

test('signal messaging runtime builds DM envelopes only after outbound secure send is ready', async () => {
  const calls = [];

  const envelope = await buildDirectMessageEnvelopeRuntime({
    recipientId: 'user-4',
    plaintext: 'hi',
    currentUserId: 'self-4',
    currentDeviceId: 7,
    ensureOutboundSignalReadyFn: async () => calls.push('ready'),
    listVerifiedDevicesForUserFn: async (...args) => {
      calls.push(['list-devices', ...args]);
      return [{ deviceId: 1 }];
    },
    listVerifiedSiblingDevicesBestEffortFn: async () => [{ deviceId: 9 }],
    buildDirectMessageTargetsFn: ({ recipientId, currentUserId }) => {
      calls.push(['targets', recipientId, currentUserId]);
      return [{ userId: 'user-4', deviceId: 1 }];
    },
    signalEncryptFn: async (userId, deviceId, plaintext) => {
      calls.push(['encrypt', userId, deviceId, plaintext]);
      return { type: 3, payload: 'payload-1' };
    },
    buildDirectMessageEnvelopePayloadFn: ({ recipientId, senderDeviceId, copies }) => ({
      recipientId,
      senderDeviceId,
      copies,
    }),
  });

  assert.deepEqual(calls, [
    'ready',
    ['list-devices', 'user-4', { forceRefresh: true }],
    ['targets', 'user-4', 'self-4'],
    ['encrypt', 'user-4', 1, 'hi'],
  ]);
  assert.deepEqual(envelope, {
    recipientId: 'user-4',
    senderDeviceId: 7,
    copies: [
      {
        recipientUserId: 'user-4',
        recipientDeviceId: 1,
        type: 3,
        payload: 'payload-1',
      },
    ],
  });
});

test('signal messaging runtime rejects DM envelope building when the current user is missing', async () => {
  await assert.rejects(
    buildDirectMessageEnvelopeRuntime({
      recipientId: 'user-5',
      plaintext: 'hi',
    }),
    /Signal user not initialized/,
  );
});

test('signal messaging runtime normalizes group decrypt failures into thrown errors', async () => {
  await assert.rejects(
    decryptSignalGroupMessage({
      senderId: 'user-6',
      roomId: 'room-1',
      payload: 'ciphertext',
      groupDecryptFn: async () => ({
        ok: false,
        error: {
          message: 'missing sender key',
          code: 'NO_SENDER_KEY',
          operation: 'groupDecrypt',
        },
      }),
    }),
    (err) => err?.message === 'missing sender key'
      && err?.code === 'NO_SENDER_KEY'
      && err?.operation === 'groupDecrypt',
  );
});

test('signal messaging runtime gates sender-key room operations behind outbound readiness', async () => {
  const calls = [];

  const skdm = await createSignalSenderKeyDistributionMessage({
    roomId: 'room-2',
    ensureOutboundSignalReadyFn: async () => calls.push('ready-skdm'),
    createSKDMFn: async (roomId) => {
      calls.push(['skdm', roomId]);
      return 'skdm-payload';
    },
  });

  const ciphertext = await encryptSignalGroupMessage({
    roomId: 'room-2',
    plaintext: 'group hello',
    ensureOutboundSignalReadyFn: async () => calls.push('ready-encrypt'),
    groupEncryptFn: async (roomId, plaintext) => {
      calls.push(['encrypt', roomId, plaintext]);
      return 'group-ciphertext';
    },
  });

  const rekeyed = await rekeySignalRoom({
    roomId: 'room-2',
    ensureOutboundSignalReadyFn: async () => calls.push('ready-rekey'),
    rekeyRoomFn: async (roomId) => {
      calls.push(['rekey', roomId]);
      return 'rekeyed';
    },
  });

  assert.equal(skdm, 'skdm-payload');
  assert.equal(ciphertext, 'group-ciphertext');
  assert.equal(rekeyed, 'rekeyed');
  assert.deepEqual(calls, [
    'ready-skdm',
    ['skdm', 'room-2'],
    'ready-encrypt',
    ['encrypt', 'room-2', 'group hello'],
    'ready-rekey',
    ['rekey', 'room-2'],
  ]);
});
