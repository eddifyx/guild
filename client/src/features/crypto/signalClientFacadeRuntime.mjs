import { createSignalClientBundleRuntime } from './signalClientBundleRuntime.mjs';
import { createSignalClientIdentityRuntime } from './signalClientIdentityRuntime.mjs';
import { createSignalClientMaintenanceRuntime } from './signalClientMaintenanceRuntime.mjs';
import {
  createRemoteIdentityCacheLoader,
  loadRemoteIdentityVerificationState,
} from './signalIdentityRuntime.mjs';
import {
  destroySignalLifecycle,
  ensureOutboundSignalLifecycleReady,
  initializeSignalLifecycle,
} from './signalLifecycleRuntime.mjs';
import { createSignalClientIdentityFacadeRuntime } from './signalClientIdentityFacadeRuntime.mjs';
import { createSignalClientMessagingFacadeRuntime } from './signalClientMessagingFacadeRuntime.mjs';
import { createSignalClientSessionRuntime } from './signalClientSessionRuntime.mjs';
import {
  buildSignalBundleRuntimeOptions,
  buildSignalIdentityFacadeRuntimeOptions,
  buildSignalIdentityRuntimeOptions,
  buildSignalMaintenanceRuntimeOptions,
  buildSignalMessagingFacadeRuntimeOptions,
  buildSignalSessionRuntimeOptions,
} from './signalClientFacadeBindings.mjs';
import {
  buildDirectMessageEnvelopeRuntime,
  createSignalSenderKeyDistributionMessage,
  decryptSignalGroupMessage,
  decryptSignalMessage,
  encryptSignalGroupMessage,
  encryptSignalMessage,
  ensureSignalMessageSession,
  rekeySignalRoom,
} from './signalMessagingRuntime.mjs';

export function createSignalClientFacadeRuntime({
  signalCrypto,
  uploadPreKeyBundleFn,
  fetchPreKeyBundleFn,
  fetchIdentityAttestationFn,
  fetchDeviceIdentityRecordsFn,
  getOTPCountFn,
  getKyberCountFn,
  replenishOTPsUploadFn,
  replenishKyberUploadFn,
  resetEncryptionKeysFn,
  loadCachedBundleAttestationFn,
  signBundleAttestationFn,
  storeBundleAttestationFn,
  verifyBundleAttestationFn,
  getKnownNpubFn,
  buildDirectMessageEnvelopePayloadFn,
  buildDirectMessageTargetsFn,
  getAddressKeyFn,
  getStableBundleFn,
  isDeferredBundleAttestationErrorFn,
  otpThreshold = 20,
  kyberThreshold = 5,
  kyberBatchSize = 20,
  prekeyMessageType = 3,
  createRemoteIdentityCacheLoaderFn = createRemoteIdentityCacheLoader,
  createSignalClientBundleRuntimeFn = createSignalClientBundleRuntime,
  createSignalClientIdentityRuntimeFn = createSignalClientIdentityRuntime,
  createSignalClientMaintenanceRuntimeFn = createSignalClientMaintenanceRuntime,
  loadRemoteIdentityVerificationStateFn = loadRemoteIdentityVerificationState,
  initializeSignalLifecycleFn = initializeSignalLifecycle,
  ensureOutboundSignalLifecycleReadyFn = ensureOutboundSignalLifecycleReady,
  destroySignalLifecycleFn = destroySignalLifecycle,
  createSignalClientIdentityFacadeRuntimeFn = createSignalClientIdentityFacadeRuntime,
  createSignalClientMessagingFacadeRuntimeFn = createSignalClientMessagingFacadeRuntime,
  createSignalClientSessionRuntimeFn = createSignalClientSessionRuntime,
  ensureSignalMessageSessionFn = ensureSignalMessageSession,
  encryptSignalMessageFn = encryptSignalMessage,
  decryptSignalMessageFn = decryptSignalMessage,
  buildDirectMessageEnvelopeRuntimeFn = buildDirectMessageEnvelopeRuntime,
  createSignalSenderKeyDistributionMessageFn = createSignalSenderKeyDistributionMessage,
  encryptSignalGroupMessageFn = encryptSignalGroupMessage,
  decryptSignalGroupMessageFn = decryptSignalGroupMessage,
  rekeySignalRoomFn = rekeySignalRoom,
} = {}) {
  const remoteIdentityCache = new Map();
  const sessionBootstrapRecipients = new Set();

  const state = {
    initialized: false,
    userId: null,
    deviceId: 1,
    userNpub: null,
    initPromise: null,
    maintenanceInterval: null,
    outboundSignalBlockedReason: null,
  };

  const fetchDeviceIdentityRecordsCached = createRemoteIdentityCacheLoaderFn({
    remoteIdentityCache,
    fetchDeviceIdentityRecordsFn,
    fetchIdentityAttestationFn,
  });

  const signalBundleRuntime = createSignalClientBundleRuntimeFn(
    buildSignalBundleRuntimeOptions({
      state,
      signalCrypto,
      getStableBundleFn,
      loadCachedBundleAttestationFn,
      signBundleAttestationFn,
      storeBundleAttestationFn,
      uploadPreKeyBundleFn,
      otpThreshold,
      kyberThreshold,
      kyberBatchSize,
    })
  );

  const signalMaintenanceRuntime = createSignalClientMaintenanceRuntimeFn(
    buildSignalMaintenanceRuntimeOptions({
      state,
      signalCrypto,
      getOTPCountFn,
      replenishOTPsUploadFn,
      getKyberCountFn,
      replenishKyberUploadFn,
      otpThreshold,
      kyberThreshold,
      kyberBatchSize,
    })
  );

  const signalIdentityRuntime = createSignalClientIdentityRuntimeFn(
    buildSignalIdentityRuntimeOptions({
      state,
      signalCrypto,
      getKnownNpubFn,
      getStableBundleFn,
      verifyBundleAttestationFn,
      fetchDeviceIdentityRecordsFn,
      fetchDeviceIdentityRecordsCachedFn: fetchDeviceIdentityRecordsCached,
      fetchPreKeyBundleFn,
      signalBundleRuntime,
    })
  );

  const signalSessionRuntime = createSignalClientSessionRuntimeFn(
    buildSignalSessionRuntimeOptions({
      state,
      remoteIdentityCache,
      sessionBootstrapRecipients,
      signalCrypto,
      signalIdentityRuntime,
      signalBundleRuntime,
      signalMaintenanceRuntime,
      resetEncryptionKeysFn,
      isDeferredBundleAttestationErrorFn,
      initializeSignalLifecycleFn,
      ensureOutboundSignalLifecycleReadyFn,
      destroySignalLifecycleFn,
      ensureSignalMessageSessionFn,
      getAddressKeyFn,
    })
  );

  const signalIdentityFacadeRuntime = createSignalClientIdentityFacadeRuntimeFn(
    buildSignalIdentityFacadeRuntimeOptions({
      signalCrypto,
      fetchDeviceIdentityRecordsCachedFn: fetchDeviceIdentityRecordsCached,
      signalIdentityRuntime,
      loadRemoteIdentityVerificationStateFn,
    })
  );

  const signalMessagingFacadeRuntime = createSignalClientMessagingFacadeRuntimeFn(
    buildSignalMessagingFacadeRuntimeOptions({
      signalCrypto,
      state,
      signalSessionRuntime,
      signalIdentityRuntime,
      buildDirectMessageEnvelopePayloadFn,
      buildDirectMessageTargetsFn,
      prekeyMessageType,
      encryptSignalMessageFn,
      decryptSignalMessageFn,
      buildDirectMessageEnvelopeRuntimeFn,
      createSignalSenderKeyDistributionMessageFn,
      encryptSignalGroupMessageFn,
      decryptSignalGroupMessageFn,
      rekeySignalRoomFn,
    })
  );

  return {
    initializeSignalCrypto: signalSessionRuntime.initializeSignalCrypto,
    destroySignalCrypto: signalSessionRuntime.destroySignalCrypto,
    isSignalInitialized: signalSessionRuntime.isSignalInitialized,
    getSignalUserId: signalSessionRuntime.getSignalUserId,
    getSignalDeviceId: signalSessionRuntime.getSignalDeviceId,
    signalEncrypt: signalMessagingFacadeRuntime.signalEncrypt,
    signalDecrypt: signalMessagingFacadeRuntime.signalDecrypt,
    hasSession: signalIdentityFacadeRuntime.hasSession,
    deleteSession: signalIdentityFacadeRuntime.deleteSession,
    getIdentityStatus: signalIdentityFacadeRuntime.getIdentityStatus,
    loadRemoteIdentityVerification: signalIdentityFacadeRuntime.loadRemoteIdentityVerification,
    approveIdentity: signalIdentityFacadeRuntime.approveIdentity,
    markIdentityVerified: signalIdentityFacadeRuntime.markIdentityVerified,
    buildDirectMessageEnvelope: signalMessagingFacadeRuntime.buildDirectMessageEnvelope,
    createSKDM: signalMessagingFacadeRuntime.createSKDM,
    processSKDM: signalMessagingFacadeRuntime.processSKDM,
    groupEncrypt: signalMessagingFacadeRuntime.groupEncrypt,
    groupDecrypt: signalMessagingFacadeRuntime.groupDecrypt,
    rekeyRoom: signalMessagingFacadeRuntime.rekeyRoom,
    getFingerprint: signalIdentityFacadeRuntime.getFingerprint,
  };
}
