import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientSessionRuntime } from '../../../client/src/features/crypto/signalClientSessionRuntime.mjs';

function createRuntime(overrides = {}) {
  const calls = [];
  const state = {
    initialized: false,
    userId: null,
    deviceId: 1,
    userNpub: null,
    initPromise: null,
    maintenanceInterval: 'interval-1',
    outboundSignalBlockedReason: null,
  };
  const remoteIdentityCache = new Map([['cached', true]]);
  const sessionBootstrapRecipients = new Set(['user-x:1']);

  const runtime = createSignalClientSessionRuntime({
    state,
    remoteIdentityCache,
    sessionBootstrapRecipients,
    signalCrypto: {
      hasSession: async (...args) => {
        calls.push(['has-session', ...args]);
        return true;
      },
    },
    signalIdentityRuntime: {
      reconcileLocalDeviceRegistration: async (...args) => {
        calls.push(['reconcile-local-device', ...args]);
        return { deviceId: 7 };
      },
      verifyAndApproveIdentity: async (...args) => {
        calls.push(['verify-and-approve', ...args]);
        return true;
      },
      fetchVerifiedIdentity: async (...args) => {
        calls.push(['fetch-verified-identity', ...args]);
        return { identityKey: 'verified' };
      },
      bootstrapSessionFromVerifiedBundle: async (...args) => {
        calls.push(['bootstrap-session', ...args]);
        return true;
      },
      requireTrustedNpub: async (...args) => {
        calls.push(['require-trusted-npub', ...args]);
        return 'npub-target';
      },
    },
    signalBundleRuntime: {
      uploadSignedBundle: async (...args) => {
        calls.push(['upload-signed-bundle', ...args]);
      },
    },
    signalMaintenanceRuntime: {
      scheduleKeyMaintenance: (...args) => {
        calls.push(['schedule-maintenance', ...args]);
        return 'interval-2';
      },
    },
    resetEncryptionKeysFn: async (...args) => {
      calls.push(['reset-encryption-keys', ...args]);
    },
    initializeSignalLifecycleFn: async ({ authData, clearRemoteIdentityCacheFn, clearSessionBootstrapRecipientsFn }) => {
      clearRemoteIdentityCacheFn();
      clearSessionBootstrapRecipientsFn();
      calls.push(['initialize-lifecycle', authData.userId]);
      return {
        initialized: true,
        userId: authData.userId,
        userNpub: authData.npub,
        deviceId: 5,
        outboundSignalBlockedReason: null,
      };
    },
    ensureOutboundSignalLifecycleReadyFn: async ({ userId, deviceId }) => {
      calls.push(['ensure-outbound-ready', userId, deviceId]);
      return {
        deviceId: 8,
        outboundSignalBlockedReason: 'blocked-for-test',
      };
    },
    destroySignalLifecycleFn: async ({ maintenanceInterval, clearRemoteIdentityCacheFn, clearSessionBootstrapRecipientsFn }) => {
      clearRemoteIdentityCacheFn();
      clearSessionBootstrapRecipientsFn();
      calls.push(['destroy-lifecycle', maintenanceInterval]);
      return {
        maintenanceInterval: null,
        initialized: false,
        userId: null,
        deviceId: 1,
        userNpub: null,
        initPromise: null,
        outboundSignalBlockedReason: null,
      };
    },
    ensureSignalMessageSessionFn: async (options) => {
      calls.push(['ensure-signal-message-session', options.recipientId, options.currentUserId]);
      return {
        addressKey: options.getAddressKeyFn(options.recipientId, options.recipientDeviceId),
      };
    },
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    ...overrides,
  });

  return { runtime, state, calls, remoteIdentityCache, sessionBootstrapRecipients };
}

test('signal client session runtime coalesces concurrent init and updates session state', async () => {
  const calls = [];
  let resolveInit;
  const initGate = new Promise((resolve) => {
    resolveInit = resolve;
  });
  const { runtime, state } = createRuntime({
    initializeSignalLifecycleFn: async ({ authData }) => {
      calls.push(['initialize-lifecycle', authData.userId]);
      await initGate;
      return {
        initialized: true,
        userId: authData.userId,
        userNpub: authData.npub,
        deviceId: 9,
        outboundSignalBlockedReason: null,
      };
    },
  });

  const first = runtime.initializeSignalCrypto({ userId: 'self-1', npub: 'npub-1' });
  const second = runtime.initializeSignalCrypto({ userId: 'self-1', npub: 'npub-1' });
  resolveInit();

  await Promise.all([first, second]);

  assert.deepEqual(calls, [['initialize-lifecycle', 'self-1']]);
  assert.equal(state.initialized, true);
  assert.equal(runtime.isSignalInitialized(), true);
  assert.equal(runtime.getSignalUserId(), 'self-1');
  assert.equal(runtime.getSignalDeviceId(), 9);
});

test('signal client session runtime updates device and blocked reason after outbound readiness', async () => {
  const { runtime, state, calls } = createRuntime();
  state.initialized = true;
  state.userId = 'self-2';
  state.userNpub = 'npub-2';
  state.deviceId = 4;

  const result = await runtime.ensureOutboundSignalReady();

  assert.deepEqual(calls, [['ensure-outbound-ready', 'self-2', 4]]);
  assert.equal(result.deviceId, 8);
  assert.equal(state.deviceId, 8);
  assert.equal(state.outboundSignalBlockedReason, 'blocked-for-test');
});

test('signal client session runtime destroys state and clears caches through the shared lifecycle contract', async () => {
  const { runtime, state, calls, remoteIdentityCache, sessionBootstrapRecipients } = createRuntime();
  state.initialized = true;
  state.userId = 'self-3';
  state.userNpub = 'npub-3';
  state.deviceId = 12;

  const result = await runtime.destroySignalCrypto();

  assert.deepEqual(calls, [['destroy-lifecycle', 'interval-1']]);
  assert.equal(result.initialized, false);
  assert.equal(state.initialized, false);
  assert.equal(state.userId, null);
  assert.equal(state.deviceId, 1);
  assert.equal(remoteIdentityCache.size, 0);
  assert.equal(sessionBootstrapRecipients.size, 0);
});

test('signal client session runtime builds verified session bootstrap contracts against current state', async () => {
  const { runtime, state, calls } = createRuntime();
  state.userId = 'self-4';

  const result = await runtime.ensureVerifiedSession('peer-1', 3, { identityKey: 'ik' });

  assert.equal(result.addressKey, 'peer-1:3');
  assert.deepEqual(calls, [['ensure-signal-message-session', 'peer-1', 'self-4']]);
});
