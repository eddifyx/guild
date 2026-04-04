import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bootstrapSignalSessionFromVerifiedBundle,
  buildSignalDirectMessageEnvelope,
  emitSignalSessionReady,
  ensureVerifiedSignalSession,
  normalizeSignalBundleBootstrapError,
  SIGNAL_SESSION_READY_EVENT,
} from '../../../client/src/features/crypto/signalSessionRuntime.mjs';

test('signal session runtime bootstraps self-device bundles through the untrusted-identity retry path', async () => {
  const calls = [];
  let firstAttempt = true;

  const normalizedDeviceId = await bootstrapSignalSessionFromVerifiedBundle({
    recipientId: 'user-1',
    recipientDeviceId: 2,
    currentUserId: 'user-1',
    fetchVerifiedPreKeyBundleFn: async () => ({ deviceId: 4, identityKey: 'key-1' }),
    deleteSessionFn: async (userId, deviceId) => calls.push(['delete', userId, deviceId]),
    approveIdentityFn: async (userId, deviceId, identityKey, options) => {
      calls.push(['approve', userId, deviceId, identityKey, options.verified]);
    },
    processBundleFn: async (userId, deviceId) => {
      calls.push(['process', userId, deviceId]);
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error('untrusted identity');
      }
    },
    emitSignalSessionReadyFn: ({ userId, deviceId }) => {
      calls.push(['ready', userId, deviceId]);
    },
  });

  assert.equal(normalizedDeviceId, 4);
  assert.deepEqual(calls, [
    ['approve', 'user-1', 4, 'key-1', false],
    ['process', 'user-1', 4],
    ['delete', 'user-1', 4],
    ['approve', 'user-1', 4, 'key-1', false],
    ['process', 'user-1', 4],
    ['ready', 'user-1', 4],
  ]);
});

test('signal session runtime normalizes missing-kyber bundle failures into a retryable recipient-setup error', async () => {
  const normalized = normalizeSignalBundleBootstrapError(
    new Error('Recipient has no Kyber prekeys — cannot establish PQXDH session')
  );

  assert.equal(
    normalized.message,
    'This recipient has not finished secure messaging setup yet. Ask them to reopen /guild and try again.',
  );
  assert.equal(normalized.retryable, true);

  await assert.rejects(
    bootstrapSignalSessionFromVerifiedBundle({
      recipientId: 'user-7',
      recipientDeviceId: 1,
      fetchVerifiedPreKeyBundleFn: async () => ({
        deviceId: 1,
        identityKey: 'key-7',
      }),
      processBundleFn: async () => {
        throw new Error('Recipient has no Kyber prekeys — cannot establish PQXDH session');
      },
    }),
    (error) => error?.message === normalized.message && error?.retryable === true,
  );
});

test('signal session runtime emits the canonical session-ready event for DM recovery listeners', () => {
  const events = [];
  const windowObj = {
    CustomEvent,
    dispatchEvent(event) {
      events.push(event);
    },
  };

  const emitted = emitSignalSessionReady({
    userId: 'user-9',
    deviceId: 3,
    windowObj,
  });

  assert.equal(emitted, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, SIGNAL_SESSION_READY_EVENT);
  assert.deepEqual(events[0].detail, { userId: 'user-9', deviceId: 3 });
});

test('signal session runtime reuses trusted sessions before consuming a new bundle', async () => {
  const sessionBootstrapRecipients = new Set();
  const calls = [];

  const result = await ensureVerifiedSignalSession({
    recipientId: 'user-2',
    recipientDeviceId: 3,
    sessionBootstrapRecipients,
    requireTrustedNpubFn: async () => calls.push('trust'),
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    hasSessionFn: async () => true,
    verifyAndApproveIdentityFn: async () => calls.push('verify'),
    fetchVerifiedIdentityFn: async () => calls.push('fetch-identity'),
    bootstrapSessionFromVerifiedBundleFn: async () => calls.push('bootstrap'),
  });

  assert.deepEqual(calls, ['trust', 'fetch-identity']);
  assert.equal(result.bootstrapped, false);
  assert.equal(sessionBootstrapRecipients.has('user-2:3'), true);
});

test('signal session runtime bootstraps missing sessions and builds DM envelopes through the canonical fanout path', async () => {
  const calls = [];
  const sessionBootstrapRecipients = new Set(['user-2:1']);

  const ensured = await ensureVerifiedSignalSession({
    recipientId: 'user-2',
    recipientDeviceId: 1,
    sessionBootstrapRecipients,
    requireTrustedNpubFn: async () => calls.push('trust'),
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    hasSessionFn: async () => false,
    verifyAndApproveIdentityFn: async () => calls.push('verify'),
    fetchVerifiedIdentityFn: async () => calls.push('fetch-identity'),
    bootstrapSessionFromVerifiedBundleFn: async () => calls.push('bootstrap'),
  });

  assert.equal(ensured.bootstrapped, true);
  assert.deepEqual(calls, ['trust', 'bootstrap']);

  const envelope = await buildSignalDirectMessageEnvelope({
    recipientId: 'user-2',
    plaintext: 'hello guild',
    currentUserId: 'user-1',
    currentDeviceId: 7,
    listVerifiedDevicesForUserFn: async (...args) => {
      calls.push(['list-recipient-devices', ...args]);
      return [{ deviceId: 1 }];
    },
    listVerifiedSiblingDevicesBestEffortFn: async () => [{ deviceId: 9 }],
    buildDirectMessageTargetsFn: ({ recipientId, recipientDevices, selfDevices, currentUserId }) => {
      assert.equal(recipientId, 'user-2');
      assert.equal(currentUserId, 'user-1');
      assert.equal(recipientDevices[0].deviceId, 1);
      assert.equal(selfDevices[0].deviceId, 9);
      return [
        { userId: 'user-2', deviceId: 1 },
        { userId: 'user-1', deviceId: 9 },
      ];
    },
    signalEncryptFn: async (userId, deviceId, plaintext) => ({
      type: 3,
      payload: `${userId}:${deviceId}:${plaintext}`,
    }),
    buildDirectMessageEnvelopePayloadFn: ({ recipientId, senderDeviceId, copies }) => ({
      recipientId,
      senderDeviceId,
      copies,
    }),
  });

  assert.deepEqual(envelope, {
    recipientId: 'user-2',
    senderDeviceId: 7,
    copies: [
      {
        recipientUserId: 'user-2',
        recipientDeviceId: 1,
        type: 3,
        payload: 'user-2:1:hello guild',
      },
      {
        recipientUserId: 'user-1',
        recipientDeviceId: 9,
        type: 3,
        payload: 'user-1:9:hello guild',
      },
    ],
  });
  assert.deepEqual(calls.at(-1), ['list-recipient-devices', 'user-2', { forceRefresh: true }]);
});

test('signal session runtime falls back to cached recipient identities when DM device refresh fails', async () => {
  const calls = [];

  const envelope = await buildSignalDirectMessageEnvelope({
    recipientId: 'user-9',
    plaintext: 'hello fallback',
    currentUserId: 'self-9',
    currentDeviceId: 3,
    listVerifiedDevicesForUserFn: async (...args) => {
      calls.push(['list-recipient-devices', ...args]);
      if (args[1]?.forceRefresh) {
        throw new Error('identity refresh unavailable');
      }
      return [{ deviceId: 5 }];
    },
    listVerifiedSiblingDevicesBestEffortFn: async () => [],
    buildDirectMessageTargetsFn: ({ recipientDevices }) => recipientDevices.map((identity) => ({
      userId: 'user-9',
      deviceId: identity.deviceId,
    })),
    signalEncryptFn: async (userId, deviceId, plaintext) => ({
      type: 3,
      payload: `${userId}:${deviceId}:${plaintext}`,
    }),
    buildDirectMessageEnvelopePayloadFn: ({ senderDeviceId, copies }) => ({
      senderDeviceId,
      copies,
    }),
    logWarnFn: (...args) => calls.push(['warn', ...args]),
  });

  assert.deepEqual(envelope, {
    senderDeviceId: 3,
    copies: [
      {
        recipientUserId: 'user-9',
        recipientDeviceId: 5,
        type: 3,
        payload: 'user-9:5:hello fallback',
      },
    ],
  });
  assert.deepEqual(calls, [
    ['list-recipient-devices', 'user-9', { forceRefresh: true }],
    ['warn', '[Signal] Falling back to cached recipient device identities for DM fanout:', 'identity refresh unavailable'],
    ['list-recipient-devices', 'user-9'],
  ]);
});
