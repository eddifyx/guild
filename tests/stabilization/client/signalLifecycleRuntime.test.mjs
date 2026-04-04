import test from 'node:test';
import assert from 'node:assert/strict';

import {
  destroySignalLifecycle,
  ensureOutboundSignalLifecycleReady,
  initializeSignalLifecycle,
} from '../../../client/src/features/crypto/signalLifecycleRuntime.mjs';

test('signal lifecycle runtime initializes and schedules maintenance when outbound send is ready', async () => {
  const calls = [];

  const result = await initializeSignalLifecycle({
    authData: { userId: 'user-1', npub: 'npub-1' },
    signalCrypto: {
      initialize: async (userId) => {
        calls.push(['initialize', userId]);
        return { deviceId: 7 };
      },
      getDeviceId: async () => 11,
    },
    currentDeviceId: 1,
    reconcileLocalDeviceRegistrationFn: async (authData, deviceId) => {
      calls.push(['reconcile', authData.userId, deviceId]);
      return { deviceId: 9 };
    },
    uploadSignedBundleFn: async (authData, options) => {
      calls.push(['upload', authData.userId, options?.deviceId]);
    },
    confirmPublishedLocalDeviceRegistrationFn: async (authData, deviceId) => {
      calls.push(['confirm', authData.userId, deviceId]);
      return { published: true };
    },
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
    clearRemoteIdentityCacheFn: () => calls.push(['clear-identity-cache']),
    clearSessionBootstrapRecipientsFn: () => calls.push(['clear-bootstrap-cache']),
  });

  assert.deepEqual(result, {
    initialized: true,
    userId: 'user-1',
    userNpub: 'npub-1',
    deviceId: 9,
    outboundSignalBlockedReason: null,
  });
  assert.deepEqual(calls, [
    ['initialize', 'user-1'],
    ['reconcile', 'user-1', 7],
    ['upload', 'user-1', 9],
    ['confirm', 'user-1', 9],
    ['clear-identity-cache'],
    ['clear-bootstrap-cache'],
    ['maintain-now'],
    ['schedule'],
  ]);
});

test('signal lifecycle runtime keeps startup alive when bundle attestation is deferred', async () => {
  const calls = [];
  const deferredError = new Error('signer unavailable');

  const result = await initializeSignalLifecycle({
    authData: { userId: 'user-2', npub: 'npub-2' },
    allowDeferredBundleAttestation: true,
    signalCrypto: {
      initialize: async () => ({ isNew: false }),
      getDeviceId: async () => 5,
    },
    reconcileLocalDeviceRegistrationFn: async () => ({
      deviceId: 5,
      canUploadBundle: false,
      uploadBlockReason: 'Secure messaging is waiting for device verification.',
    }),
    uploadSignedBundleFn: async (...args) => {
      calls.push(['upload-attempt', args[1]?.deviceId ?? null]);
      throw deferredError;
    },
    isDeferredBundleAttestationErrorFn: (err) => err === deferredError,
    clearRemoteIdentityCacheFn: () => calls.push('clear-identity-cache'),
    clearSessionBootstrapRecipientsFn: () => calls.push('clear-bootstrap-cache'),
    scheduleKeyMaintenanceFn: () => calls.push('schedule'),
    logWarnFn: (...args) => calls.push(args.join(' ')),
  });

  assert.equal(result.deviceId, 5);
  assert.equal(
    result.outboundSignalBlockedReason,
    'Secure messaging is waiting for device verification.',
  );
  assert.equal(calls.includes('schedule'), false);
  assert.equal(
    calls.some((entry) => String(entry).includes('Continuing startup with outbound secure send paused')),
    true,
  );
  assert.equal(
    calls.some((entry) => String(entry).includes('Deferring signer-backed bundle publication')),
    true,
  );
});

test('signal lifecycle runtime resets server keys on new-device rotation mismatch', async () => {
  const calls = [];
  let firstAttempt = true;

  await initializeSignalLifecycle({
    authData: { userId: 'user-3', npub: 'npub-3' },
    signalCrypto: {
      initialize: async () => ({ isNew: true, deviceId: 2 }),
    },
    reconcileLocalDeviceRegistrationFn: async () => ({ deviceId: 2 }),
    uploadSignedBundleFn: async (_authData, options) => {
      calls.push(`upload:${options?.deviceId ?? 'none'}`);
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error('rotation mismatch');
      }
    },
    confirmPublishedLocalDeviceRegistrationFn: async (_authData, deviceId) => {
      calls.push(`confirm:${deviceId}`);
      return { published: true };
    },
    resetEncryptionKeysFn: async () => calls.push('reset'),
    clearRemoteIdentityCacheFn: () => calls.push('clear-identity-cache'),
    clearSessionBootstrapRecipientsFn: () => calls.push('clear-bootstrap-cache'),
    runKeyMaintenanceNowFn: async () => calls.push('maintain-now'),
    scheduleKeyMaintenanceFn: () => calls.push('schedule'),
    logWarnFn: (message) => calls.push(message),
  });

  assert.deepEqual(calls, [
    'upload:2',
    '[Signal] Key mismatch - resetting server keys',
    'reset',
    'upload:2',
    'confirm:2',
    'clear-identity-cache',
    'clear-bootstrap-cache',
    'maintain-now',
    'schedule',
  ]);
});

test('signal lifecycle runtime rechecks registration before resuming outbound send', async () => {
  const calls = [];

  const result = await ensureOutboundSignalLifecycleReady({
    outboundSignalBlockedReason: 'Secure messaging is waiting for device verification.',
    userId: 'user-4',
    userNpub: 'npub-4',
    deviceId: 3,
    reconcileLocalDeviceRegistrationFn: async (authData, deviceId) => {
      calls.push(['reconcile', authData.userId, authData.npub, deviceId]);
      return { deviceId: 8, canUploadBundle: true };
    },
    uploadSignedBundleFn: async (authData, options) => calls.push(['upload', authData.userId, options?.deviceId]),
    confirmPublishedLocalDeviceRegistrationFn: async (authData, deviceId) => {
      calls.push(['confirm', authData.userId, deviceId]);
      return { published: true };
    },
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
  });

  assert.deepEqual(result, {
    deviceId: 8,
    outboundSignalBlockedReason: null,
    performedUpload: true,
  });
  assert.deepEqual(calls, [
    ['reconcile', 'user-4', 'npub-4', 3],
    ['upload', 'user-4', 8],
    ['confirm', 'user-4', 8],
    ['maintain-now'],
    ['schedule'],
  ]);
});

test('signal lifecycle runtime force republishes when the remote device bundle still does not match', async () => {
  const calls = [];
  let confirmationCount = 0;

  await initializeSignalLifecycle({
    authData: { userId: 'user-6', npub: 'npub-6' },
    signalCrypto: {
      initialize: async () => ({ deviceId: 22 }),
    },
    reconcileLocalDeviceRegistrationFn: async () => ({ deviceId: 22 }),
    uploadSignedBundleFn: async (_authData, options) => {
      calls.push(['upload', options?.deviceId, options?.forceFreshAttestation === true]);
    },
    confirmPublishedLocalDeviceRegistrationFn: async () => {
      confirmationCount += 1;
      return { published: confirmationCount > 1 };
    },
    clearRemoteIdentityCacheFn: () => calls.push(['clear-identity-cache']),
    clearSessionBootstrapRecipientsFn: () => calls.push(['clear-bootstrap-cache']),
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
    logWarnFn: (...args) => calls.push(['warn', args.join(' ')]),
  });

  assert.deepEqual(calls, [
    ['upload', 22, false],
    ['warn', '[Signal] Remote device bundle missing after upload; forcing a fresh re-publish for device: 22'],
    ['upload', 22, true],
    ['clear-identity-cache'],
    ['clear-bootstrap-cache'],
    ['maintain-now'],
    ['schedule'],
  ]);
});

test('signal lifecycle runtime keeps startup alive when signer-backed republish must be deferred', async () => {
  const calls = [];
  const deferredError = new Error('Nostr signer unavailable for Signal identity attestation');

  const result = await initializeSignalLifecycle({
    authData: { userId: 'user-6b', npub: 'npub-6b' },
    allowDeferredBundleAttestation: true,
    signalCrypto: {
      initialize: async () => ({ deviceId: 44 }),
    },
    reconcileLocalDeviceRegistrationFn: async () => ({ deviceId: 44 }),
    uploadSignedBundleFn: async (_authData, options) => {
      calls.push(['upload', options?.deviceId, options?.forceFreshAttestation === true]);
      if (options?.forceFreshAttestation === true) {
        throw deferredError;
      }
    },
    confirmPublishedLocalDeviceRegistrationFn: async () => ({ published: false }),
    isDeferredBundleAttestationErrorFn: (err) => err === deferredError,
    clearRemoteIdentityCacheFn: () => calls.push(['clear-identity-cache']),
    clearSessionBootstrapRecipientsFn: () => calls.push(['clear-bootstrap-cache']),
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
    logWarnFn: (...args) => calls.push(['warn', args.join(' ')]),
  });

  assert.deepEqual(result, {
    initialized: true,
    userId: 'user-6b',
    userNpub: 'npub-6b',
    deviceId: 44,
    outboundSignalBlockedReason: 'Secure messaging is waiting for your Nostr signer to publish this device bundle.',
  });
  assert.deepEqual(calls, [
    ['upload', 44, false],
    ['warn', '[Signal] Remote device bundle missing after upload; forcing a fresh re-publish for device: 44'],
    ['upload', 44, true],
    ['warn', '[Signal] Deferring signer-backed bundle publication until a signer is available again: Nostr signer unavailable for Signal identity attestation'],
    ['clear-identity-cache'],
    ['clear-bootstrap-cache'],
  ]);
});

test('signal lifecycle runtime resets local signal state and retries when legacy device 1 still does not confirm', async () => {
  const calls = [];
  let confirmationCount = 0;

  const result = await initializeSignalLifecycle({
    authData: { userId: 'user-legacy', npub: 'npub-legacy' },
    signalCrypto: {
      initialize: async () => {
        calls.push(['initialize']);
        return { deviceId: 1 };
      },
      getDeviceId: async () => 1,
      resetLocalState: async (userId) => {
        calls.push(['reset-local-state', userId]);
      },
    },
    reconcileLocalDeviceRegistrationFn: async () => ({ deviceId: 1 }),
    uploadSignedBundleFn: async (_authData, options) => {
      calls.push(['upload', options?.deviceId, options?.forceFreshAttestation === true]);
    },
    confirmPublishedLocalDeviceRegistrationFn: async () => {
      confirmationCount += 1;
      if (confirmationCount < 3) {
        return {
          published: false,
          identities: [{
            deviceId: 1,
          }],
        };
      }
      return {
        published: true,
        identities: [{
          deviceId: 1,
        }],
      };
    },
    clearRemoteIdentityCacheFn: () => calls.push(['clear-identity-cache']),
    clearSessionBootstrapRecipientsFn: () => calls.push(['clear-bootstrap-cache']),
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
    logWarnFn: (...args) => calls.push(['warn', args.join(' ')]),
  });

  assert.deepEqual(result, {
    initialized: true,
    userId: 'user-legacy',
    userNpub: 'npub-legacy',
    deviceId: 1,
    outboundSignalBlockedReason: null,
  });
  assert.deepEqual(calls, [
    ['initialize'],
    ['upload', 1, false],
    ['warn', '[Signal] Remote device bundle missing after upload; forcing a fresh re-publish for device: 1'],
    ['upload', 1, true],
    ['warn', '[Signal] Device 1 bundle still mismatched after re-publish; resetting local Signal state and retrying once for user: user-legacy'],
    ['reset-local-state', 'user-legacy'],
    ['initialize'],
    ['upload', 1, true],
    ['clear-identity-cache'],
    ['clear-bootstrap-cache'],
    ['maintain-now'],
    ['schedule'],
  ]);
});

test('signal lifecycle runtime self-heals already-ready outbound sessions when the published device bundle is missing', async () => {
  const calls = [];
  let confirmationCount = 0;

  const result = await ensureOutboundSignalLifecycleReady({
    outboundSignalBlockedReason: null,
    userId: 'user-7',
    userNpub: 'npub-7',
    deviceId: 127,
    confirmPublishedLocalDeviceRegistrationFn: async (authData, deviceId) => {
      calls.push(['confirm', authData.userId, deviceId]);
      confirmationCount += 1;
      return { published: confirmationCount > 1 };
    },
    uploadSignedBundleFn: async (authData, options) => {
      calls.push(['upload', authData.userId, options?.deviceId, options?.forceFreshAttestation === true]);
    },
    runKeyMaintenanceNowFn: async () => calls.push(['maintain-now']),
    scheduleKeyMaintenanceFn: () => calls.push(['schedule']),
  });

  assert.deepEqual(result, {
    deviceId: 127,
    outboundSignalBlockedReason: null,
    performedUpload: true,
  });
  assert.deepEqual(calls, [
    ['confirm', 'user-7', 127],
    ['upload', 'user-7', 127, true],
    ['confirm', 'user-7', 127],
    ['maintain-now'],
    ['schedule'],
  ]);
});

test('signal lifecycle runtime preserves retryable errors when outbound send is still blocked', async () => {
  await assert.rejects(
    ensureOutboundSignalLifecycleReady({
      outboundSignalBlockedReason: 'Secure messaging is waiting for device verification.',
      userId: 'user-5',
      deviceId: 4,
      reconcileLocalDeviceRegistrationFn: async () => ({
        deviceId: 6,
        canUploadBundle: false,
        uploadBlockReason: 'Still blocked',
      }),
    }),
    (err) => err?.message === 'Still blocked' && err?.retryable === true,
  );
});

test('signal lifecycle runtime destroys crypto state and clears caches', async () => {
  const calls = [];

  const result = await destroySignalLifecycle({
    maintenanceInterval: 'interval-1',
    clearIntervalFn: (value) => calls.push(['clear-interval', value]),
    signalCrypto: {
      destroy: async () => calls.push(['destroy-crypto']),
    },
    clearRemoteIdentityCacheFn: () => calls.push(['clear-identity-cache']),
    clearSessionBootstrapRecipientsFn: () => calls.push(['clear-bootstrap-cache']),
  });

  assert.deepEqual(calls, [
    ['clear-interval', 'interval-1'],
    ['destroy-crypto'],
    ['clear-identity-cache'],
    ['clear-bootstrap-cache'],
  ]);
  assert.deepEqual(result, {
    maintenanceInterval: null,
    initialized: false,
    userId: null,
    deviceId: 1,
    userNpub: null,
    initPromise: null,
    outboundSignalBlockedReason: null,
  });
});
