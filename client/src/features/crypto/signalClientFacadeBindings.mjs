export function buildSignalBundleRuntimeOptions({
  state,
  signalCrypto,
  getStableBundleFn,
  loadCachedBundleAttestationFn,
  signBundleAttestationFn,
  storeBundleAttestationFn,
  uploadPreKeyBundleFn,
  otpThreshold = 20,
  kyberThreshold = 5,
  kyberBatchSize = 20,
} = {}) {
  return {
    getCurrentDeviceIdFn: () => state?.deviceId || 1,
    getBundleFn: () => signalCrypto?.getBundle?.(),
    getStableBundleFn,
    loadCachedBundleAttestationFn,
    signBundleAttestationFn,
    storeBundleAttestationFn,
    uploadPreKeyBundleFn,
    otpCountFn: () => signalCrypto?.otpCount?.(),
    replenishOTPsFn: (count) => signalCrypto?.replenishOTPs?.(count),
    kyberCountFn: () => signalCrypto?.kyberCount?.(),
    replenishKyberFn: (count) => signalCrypto?.replenishKyber?.(count),
    otpThreshold,
    kyberThreshold,
    kyberBatchSize,
  };
}

export function buildSignalMaintenanceRuntimeOptions({
  state,
  signalCrypto,
  getOTPCountFn,
  replenishOTPsUploadFn,
  getKyberCountFn,
  replenishKyberUploadFn,
  otpThreshold = 20,
  kyberThreshold = 5,
  kyberBatchSize = 20,
} = {}) {
  return {
    getMaintenanceIntervalFn: () => state?.maintenanceInterval,
    setMaintenanceIntervalFn: (nextIntervalId) => {
      state.maintenanceInterval = nextIntervalId;
    },
    isInitializedFn: () => state?.initialized,
    getOutboundSignalBlockedReasonFn: () => state?.outboundSignalBlockedReason,
    getCurrentDeviceIdFn: () => state?.deviceId,
    getOTPCountFn,
    replenishOTPsFn: (count) => signalCrypto?.replenishOTPs?.(count),
    uploadOTPsFn: replenishOTPsUploadFn,
    getKyberCountFn,
    replenishKyberFn: (count) => signalCrypto?.replenishKyber?.(count),
    uploadKyberFn: replenishKyberUploadFn,
    otpThreshold,
    kyberThreshold,
    kyberBatchSize,
  };
}

export function buildSignalIdentityRuntimeOptions({
  state,
  signalCrypto,
  getKnownNpubFn,
  getStableBundleFn,
  verifyBundleAttestationFn,
  fetchDeviceIdentityRecordsFn,
  fetchDeviceIdentityRecordsCachedFn,
  fetchPreKeyBundleFn,
  signalBundleRuntime,
} = {}) {
  return {
    getCurrentUserIdFn: () => state?.userId,
    getCurrentUserNpubFn: () => state?.userNpub,
    getCurrentDeviceIdFn: () => state?.deviceId,
    getKnownNpubFn,
    getStableBundleFn,
    verifyBundleAttestationFn,
    fetchDeviceIdentityRecordsFn,
    fetchDeviceIdentityRecordsCachedFn,
    fetchPreKeyBundleFn,
    getStableLocalBundleFn: signalBundleRuntime?.getStableLocalBundle,
    signalCrypto,
  };
}

export function buildSignalSessionRuntimeOptions({
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
} = {}) {
  return {
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
  };
}

export function buildSignalIdentityFacadeRuntimeOptions({
  signalCrypto,
  fetchDeviceIdentityRecordsCachedFn,
  signalIdentityRuntime,
  loadRemoteIdentityVerificationStateFn,
} = {}) {
  return {
    signalCrypto,
    fetchDeviceIdentityRecordsCachedFn,
    validateIdentityAttestationFn: signalIdentityRuntime?.validateIdentityAttestation,
    reconcileAttestedIdentityFn: signalIdentityRuntime?.reconcileAttestedIdentity,
    loadRemoteIdentityVerificationStateFn,
  };
}

export function buildSignalMessagingFacadeRuntimeOptions({
  signalCrypto,
  state,
  signalSessionRuntime,
  signalIdentityRuntime,
  buildDirectMessageEnvelopePayloadFn,
  buildDirectMessageTargetsFn,
  prekeyMessageType = 3,
  encryptSignalMessageFn,
  decryptSignalMessageFn,
  buildDirectMessageEnvelopeRuntimeFn,
  createSignalSenderKeyDistributionMessageFn,
  encryptSignalGroupMessageFn,
  decryptSignalGroupMessageFn,
  rekeySignalRoomFn,
} = {}) {
  return {
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
  };
}
