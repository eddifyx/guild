import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSignalBundleRuntimeOptions,
  buildSignalIdentityFacadeRuntimeOptions,
  buildSignalIdentityRuntimeOptions,
  buildSignalMaintenanceRuntimeOptions,
  buildSignalMessagingFacadeRuntimeOptions,
  buildSignalSessionRuntimeOptions,
} from '../../../client/src/features/crypto/signalClientFacadeBindings.mjs';

test('signal client facade bindings build bundle and maintenance contracts from shared state', async () => {
  const calls = [];
  const state = {
    initialized: true,
    maintenanceInterval: 'interval-1',
    outboundSignalBlockedReason: null,
    deviceId: 7,
  };
  const signalCrypto = {
    getBundle: async () => ({ registrationId: 'bundle-1' }),
    otpCount: async () => 8,
    replenishOTPs: async (count) => calls.push(['replenish-otps', count]),
    kyberCount: async () => 3,
    replenishKyber: async (count) => calls.push(['replenish-kyber', count]),
  };

  const bundleOptions = buildSignalBundleRuntimeOptions({
    state,
    signalCrypto,
    getStableBundleFn: (bundle) => bundle,
    loadCachedBundleAttestationFn: async () => null,
    signBundleAttestationFn: async () => ({ signature: 'sig' }),
    storeBundleAttestationFn: async () => {},
    uploadPreKeyBundleFn: async () => {},
  });
  const maintenanceOptions = buildSignalMaintenanceRuntimeOptions({
    state,
    signalCrypto,
    getOTPCountFn: async () => 8,
    replenishOTPsUploadFn: async () => {},
    getKyberCountFn: async () => 3,
    replenishKyberUploadFn: async () => {},
  });

  assert.equal(bundleOptions.getCurrentDeviceIdFn(), 7);
  assert.deepEqual(await bundleOptions.getBundleFn(), { registrationId: 'bundle-1' });
  await bundleOptions.replenishOTPsFn(2);
  await bundleOptions.replenishKyberFn(4);
  assert.equal(maintenanceOptions.getMaintenanceIntervalFn(), 'interval-1');
  maintenanceOptions.setMaintenanceIntervalFn('interval-2');
  assert.equal(state.maintenanceInterval, 'interval-2');
  assert.equal(maintenanceOptions.isInitializedFn(), true);
  assert.equal(maintenanceOptions.getCurrentDeviceIdFn(), 7);
  assert.deepEqual(calls, [
    ['replenish-otps', 2],
    ['replenish-kyber', 4],
  ]);
});

test('signal client facade bindings build identity and session contracts against live runtimes', () => {
  const state = {
    initialized: true,
    userId: 'self-1',
    userNpub: 'npub-self',
    deviceId: 9,
  };
  const remoteIdentityCache = new Map();
  const sessionBootstrapRecipients = new Set();
  const signalBundleRuntime = {
    getStableLocalBundle: async () => ({ bundle: 'stable' }),
  };
  const signalIdentityRuntime = {
    reconcileLocalDeviceRegistration: async () => ({ deviceId: 9 }),
    requireTrustedNpub: async () => 'npub-peer',
    validateIdentityAttestation: async () => true,
    reconcileAttestedIdentity: async () => true,
  };
  const signalMaintenanceRuntime = {
    scheduleKeyMaintenance: () => 'interval-3',
  };

  const identityOptions = buildSignalIdentityRuntimeOptions({
    state,
    signalCrypto: { hasSession: async () => true },
    getKnownNpubFn: () => 'npub-known',
    getStableBundleFn: (bundle) => bundle,
    verifyBundleAttestationFn: async () => true,
    fetchDeviceIdentityRecordsFn: async () => [],
    fetchDeviceIdentityRecordsCachedFn: async () => [{ deviceId: 1 }],
    fetchPreKeyBundleFn: async () => ({}),
    signalBundleRuntime,
  });
  const sessionOptions = buildSignalSessionRuntimeOptions({
    state,
    remoteIdentityCache,
    sessionBootstrapRecipients,
    signalCrypto: { hasSession: async () => true },
    signalIdentityRuntime,
    signalBundleRuntime,
    signalMaintenanceRuntime,
    resetEncryptionKeysFn: async () => {},
    isDeferredBundleAttestationErrorFn: () => false,
    initializeSignalLifecycleFn: async () => ({}),
    ensureOutboundSignalLifecycleReadyFn: async () => ({}),
    destroySignalLifecycleFn: async () => ({}),
    ensureSignalMessageSessionFn: async () => ({}),
    getAddressKeyFn: (userId, deviceId) => `${userId}:${deviceId}`,
  });
  const identityFacadeOptions = buildSignalIdentityFacadeRuntimeOptions({
    signalCrypto: { approveIdentity: async () => true },
    fetchDeviceIdentityRecordsCachedFn: async () => [{ deviceId: 1 }],
    signalIdentityRuntime,
    loadRemoteIdentityVerificationStateFn: async () => ({ ok: true }),
  });

  assert.equal(identityOptions.getCurrentUserIdFn(), 'self-1');
  assert.equal(identityOptions.getCurrentUserNpubFn(), 'npub-self');
  assert.equal(identityOptions.getCurrentDeviceIdFn(), 9);
  assert.equal(identityOptions.getStableLocalBundleFn, signalBundleRuntime.getStableLocalBundle);
  assert.equal(sessionOptions.remoteIdentityCache, remoteIdentityCache);
  assert.equal(sessionOptions.sessionBootstrapRecipients, sessionBootstrapRecipients);
  assert.equal(sessionOptions.signalIdentityRuntime, signalIdentityRuntime);
  assert.equal(sessionOptions.signalMaintenanceRuntime, signalMaintenanceRuntime);
  assert.equal(sessionOptions.getAddressKeyFn('peer-1', 4), 'peer-1:4');
  assert.equal(
    identityFacadeOptions.validateIdentityAttestationFn,
    signalIdentityRuntime.validateIdentityAttestation
  );
  assert.equal(
    identityFacadeOptions.reconcileAttestedIdentityFn,
    signalIdentityRuntime.reconcileAttestedIdentity
  );
});

test('signal client facade bindings build messaging contracts from the live session and identity runtimes', () => {
  const state = {
    userId: 'self-2',
    deviceId: 5,
  };
  const signalSessionRuntime = {
    ensureOutboundSignalReady: async () => {},
    ensureVerifiedSession: async () => true,
  };
  const signalIdentityRuntime = {
    bootstrapSessionFromVerifiedBundle: async () => true,
    requireTrustedNpub: async () => 'npub-peer',
    fetchVerifiedIdentity: async () => ({ identityKey: 'ik' }),
    listVerifiedDevicesForUser: async () => [{ deviceId: 1 }],
    listVerifiedSiblingDevicesBestEffort: async () => [{ deviceId: 3 }],
  };

  const messagingOptions = buildSignalMessagingFacadeRuntimeOptions({
    signalCrypto: { encrypt: async () => ({ type: 3, payload: 'cipher' }) },
    state,
    signalSessionRuntime,
    signalIdentityRuntime,
    buildDirectMessageEnvelopePayloadFn: ({ recipientId }) => ({ recipientId }),
    buildDirectMessageTargetsFn: ({ recipientId }) => [{ userId: recipientId, deviceId: 1 }],
    encryptSignalMessageFn: async () => ({ type: 3, payload: 'cipher' }),
    decryptSignalMessageFn: async () => 'plain',
    buildDirectMessageEnvelopeRuntimeFn: async () => ({ v: 3, copies: [] }),
    createSignalSenderKeyDistributionMessageFn: async () => 'skdm',
    encryptSignalGroupMessageFn: async () => 'group',
    decryptSignalGroupMessageFn: async () => 'group-plain',
    rekeySignalRoomFn: async () => 'rekeyed',
  });

  assert.equal(messagingOptions.state, state);
  assert.equal(messagingOptions.signalSessionRuntime, signalSessionRuntime);
  assert.equal(messagingOptions.signalIdentityRuntime, signalIdentityRuntime);
  assert.equal(messagingOptions.buildDirectMessageTargetsFn({ recipientId: 'peer-9' })[0].deviceId, 1);
  assert.equal(messagingOptions.prekeyMessageType, 3);
});
