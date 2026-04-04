import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientFacadeRuntime } from '../../../client/src/features/crypto/signalClientFacadeRuntime.mjs';

function createFacade(overrides = {}) {
  const calls = [];
  const signalCrypto = {
    getBundle: async () => ({ registrationId: 'bundle-1' }),
    otpCount: async () => 25,
    replenishOTPs: async (count) => calls.push(['replenish-local-otps', count]),
    kyberCount: async () => 10,
    replenishKyber: async (count) => calls.push(['replenish-local-kyber', count]),
    hasSession: async (...args) => {
      calls.push(['hasSession', ...args]);
      return true;
    },
    encrypt: async (...args) => {
      calls.push(['encrypt', ...args]);
      return { type: 3, payload: 'ciphertext' };
    },
    decrypt: async (...args) => {
      calls.push(['decrypt', ...args]);
      return 'plaintext';
    },
    getIdentityState: async (...args) => {
      calls.push(['identity-state', ...args]);
      return 'trusted';
    },
    approveIdentity: async (...args) => {
      calls.push(['approve-identity', ...args]);
      return true;
    },
    markIdentityVerified: async (...args) => {
      calls.push(['mark-identity', ...args]);
      return true;
    },
    deleteSession: async (...args) => {
      calls.push(['delete-session', ...args]);
      return true;
    },
    processSKDM: async (...args) => {
      calls.push(['process-skdm', ...args]);
      return 'processed';
    },
    createSKDM: async (...args) => {
      calls.push(['create-skdm', ...args]);
      return 'skdm-payload';
    },
    groupEncrypt: async (...args) => {
      calls.push(['group-encrypt', ...args]);
      return 'group-ciphertext';
    },
    groupDecrypt: async (...args) => {
      calls.push(['group-decrypt', ...args]);
      return 'group-plaintext';
    },
    rekeyRoom: async (...args) => {
      calls.push(['rekey-room', ...args]);
      return 'rekeyed';
    },
    getFingerprint: async (...args) => {
      calls.push(['fingerprint', ...args]);
      return 'fingerprint';
    },
  };

  const runtime = createSignalClientFacadeRuntime({
    signalCrypto,
    uploadPreKeyBundleFn: async () => {},
    fetchPreKeyBundleFn: async () => ({}),
    fetchIdentityAttestationFn: async () => ({}),
    fetchDeviceIdentityRecordsFn: async () => [],
    getOTPCountFn: async () => 25,
    getKyberCountFn: async () => 10,
    replenishOTPsUploadFn: async () => {},
    replenishKyberUploadFn: async () => {},
    resetEncryptionKeysFn: async () => {},
    loadCachedBundleAttestationFn: async () => null,
    signBundleAttestationFn: async () => ({ signature: 'sig' }),
    storeBundleAttestationFn: async () => {},
    verifyBundleAttestationFn: async () => true,
    getKnownNpubFn: () => 'npub-known',
    buildDirectMessageEnvelopePayloadFn: ({ recipientId, senderDeviceId, copies }) => ({
      recipientId,
      senderDeviceId,
      copies,
    }),
    buildDirectMessageTargetsFn: ({ recipientId }) => [{ userId: recipientId, deviceId: 1 }],
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
    getStableBundleFn: (bundle) => bundle,
    isDeferredBundleAttestationErrorFn: () => false,
    createRemoteIdentityCacheLoaderFn: () => async (...args) => {
      calls.push(['load-remote-cache', ...args]);
      return [{ deviceId: 1 }];
    },
    createSignalClientBundleRuntimeFn: () => ({
      getStableLocalBundle: async () => ({ bundle: 'stable' }),
      uploadSignedBundle: async (authData) => {
        calls.push(['upload-signed-bundle', authData.userId]);
      },
    }),
    createSignalClientMaintenanceRuntimeFn: () => ({
      scheduleKeyMaintenance: () => {
        calls.push(['schedule-maintenance']);
        return 'interval-1';
      },
    }),
    createSignalClientIdentityRuntimeFn: () => ({
      reconcileLocalDeviceRegistration: async (authData, deviceId) => {
        calls.push(['reconcile-registration', authData.userId, deviceId]);
        return { deviceId: 7, canUploadBundle: true };
      },
      requireTrustedNpub: async (userId, options) => {
        calls.push(['require-trusted', userId, options]);
        return 'npub-target';
      },
      verifyAndApproveIdentity: async (...args) => {
        calls.push(['verify-identity', ...args]);
        return true;
      },
      fetchVerifiedIdentity: async (...args) => {
        calls.push(['fetch-verified-identity', ...args]);
        return { identityKey: 'identity-key' };
      },
      bootstrapSessionFromVerifiedBundle: async (...args) => {
        calls.push(['bootstrap-session', ...args]);
        return true;
      },
      validateIdentityAttestation: async (...args) => {
        calls.push(['validate-attestation', ...args]);
        return true;
      },
      reconcileAttestedIdentity: async (...args) => {
        calls.push(['reconcile-attested', ...args]);
        return true;
      },
      listVerifiedDevicesForUser: async () => [{ deviceId: 1 }],
      listVerifiedSiblingDevicesBestEffort: async () => [{ deviceId: 9 }],
    }),
    initializeSignalLifecycleFn: async ({ authData, currentDeviceId }) => {
      calls.push(['initialize-lifecycle', authData.userId, currentDeviceId]);
      return {
        initialized: true,
        userId: authData.userId,
        userNpub: authData.npub,
        deviceId: 5,
        outboundSignalBlockedReason: null,
      };
    },
    ensureOutboundSignalLifecycleReadyFn: async ({ userId, deviceId }) => {
      calls.push(['ensure-outbound', userId, deviceId]);
      return {
        deviceId: 8,
        outboundSignalBlockedReason: null,
      };
    },
    destroySignalLifecycleFn: async ({ maintenanceInterval }) => {
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
      calls.push(['ensure-session', options.recipientId, options.currentUserId]);
      return {
        bootstrapped: false,
        addressKey: `${options.recipientId}:${options.recipientDeviceId}`,
      };
    },
    encryptSignalMessageFn: async (options) => {
      calls.push(['encrypt-runtime', options.recipientId]);
      await options.ensureOutboundSignalReadyFn();
      await options.ensureSignalMessageSessionFn(options.recipientId, options.recipientDeviceId);
      return options.encryptFn(options.recipientId, options.recipientDeviceId, options.plaintext);
    },
    decryptSignalMessageFn: async (options) => {
      calls.push(['decrypt-runtime', options.senderId]);
      return options.decryptFn(options.senderId, options.senderDeviceId, options.type, options.payload);
    },
    loadRemoteIdentityVerificationStateFn: async (options) => {
      calls.push(['load-remote-verification', options.recipientId]);
      return { ok: true };
    },
    buildDirectMessageEnvelopeRuntimeFn: async (options) => {
      calls.push(['build-envelope-runtime', options.currentUserId, options.currentDeviceId]);
      return options.buildDirectMessageEnvelopePayloadFn({
        recipientId: options.recipientId,
        senderDeviceId: options.currentDeviceId,
        copies: [],
      });
    },
    createSignalSenderKeyDistributionMessageFn: async (options) => {
      calls.push(['skdm-runtime', options.roomId]);
      await options.ensureOutboundSignalReadyFn();
      return options.createSKDMFn(options.roomId);
    },
    encryptSignalGroupMessageFn: async (options) => {
      calls.push(['group-encrypt-runtime', options.roomId]);
      await options.ensureOutboundSignalReadyFn();
      return options.groupEncryptFn(options.roomId, options.plaintext);
    },
    decryptSignalGroupMessageFn: async (options) => {
      calls.push(['group-decrypt-runtime', options.roomId]);
      return options.groupDecryptFn(options.senderId, options.roomId, options.payload);
    },
    rekeySignalRoomFn: async (options) => {
      calls.push(['rekey-runtime', options.roomId]);
      await options.ensureOutboundSignalReadyFn();
      return options.rekeyRoomFn(options.roomId);
    },
    ...overrides,
  });

  return { runtime, calls };
}

test('signal client facade runtime coalesces concurrent initialization and updates client state', async () => {
  const calls = [];
  let resolveInit;
  const initGate = new Promise((resolve) => {
    resolveInit = resolve;
  });
  const { runtime } = createFacade({
    initializeSignalLifecycleFn: async ({ authData, currentDeviceId }) => {
      calls.push(['initialize-lifecycle', authData.userId, currentDeviceId]);
      await initGate;
      return {
        initialized: true,
        userId: authData.userId,
        userNpub: authData.npub,
        deviceId: 6,
        outboundSignalBlockedReason: null,
      };
    },
  });

  const first = runtime.initializeSignalCrypto({ userId: 'self-1', npub: 'npub-1' });
  const second = runtime.initializeSignalCrypto({ userId: 'self-1', npub: 'npub-1' });
  resolveInit();
  await Promise.all([first, second]);

  assert.deepEqual(calls, [['initialize-lifecycle', 'self-1', 1]]);
  assert.equal(runtime.isSignalInitialized(), true);
  assert.equal(runtime.getSignalUserId(), 'self-1');
  assert.equal(runtime.getSignalDeviceId(), 6);
});

test('signal client facade runtime carries initialized state into secure message encryption', async () => {
  const { runtime, calls } = createFacade();

  await runtime.initializeSignalCrypto({ userId: 'self-2', npub: 'npub-2' });
  calls.length = 0;

  const ciphertext = await runtime.signalEncrypt('peer-1', 2, 'hello guild');

  assert.deepEqual(ciphertext, { type: 3, payload: 'ciphertext' });
  assert.deepEqual(calls, [
    ['encrypt-runtime', 'peer-1'],
    ['ensure-outbound', 'self-2', 5],
    ['ensure-session', 'peer-1', 'self-2'],
    ['encrypt', 'peer-1', 2, 'hello guild'],
  ]);
  assert.equal(runtime.getSignalDeviceId(), 8);
});

test('signal client facade runtime resets state cleanly on destroy', async () => {
  const { runtime, calls } = createFacade();

  await runtime.initializeSignalCrypto({ userId: 'self-3', npub: 'npub-3' });
  calls.length = 0;

  const result = await runtime.destroySignalCrypto();

  assert.deepEqual(result, {
    maintenanceInterval: null,
    initialized: false,
    userId: null,
    deviceId: 1,
    userNpub: null,
    initPromise: null,
    outboundSignalBlockedReason: null,
  });
  assert.deepEqual(calls, [['destroy-lifecycle', null]]);
  assert.equal(runtime.isSignalInitialized(), false);
  assert.equal(runtime.getSignalUserId(), null);
  assert.equal(runtime.getSignalDeviceId(), 1);
});

test('signal client facade runtime delegates remote identity verification through the cached loader contract', async () => {
  const { runtime, calls } = createFacade();

  const result = await runtime.loadRemoteIdentityVerification('peer-2');

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [['load-remote-verification', 'peer-2']]);
});
