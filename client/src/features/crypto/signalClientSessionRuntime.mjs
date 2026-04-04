export function createSignalClientSessionRuntime({
  state = {},
  remoteIdentityCache = new Map(),
  sessionBootstrapRecipients = new Set(),
  signalCrypto = null,
  signalIdentityRuntime = {},
  signalBundleRuntime = {},
  signalMaintenanceRuntime = {},
  resetEncryptionKeysFn = async () => {},
  isDeferredBundleAttestationErrorFn = () => false,
  initializeSignalLifecycleFn = async () => ({}),
  ensureOutboundSignalLifecycleReadyFn = async () => ({}),
  destroySignalLifecycleFn = async () => ({}),
  ensureSignalMessageSessionFn = async () => ({}),
  getAddressKeyFn = () => '',
} = {}) {
  async function ensureOutboundSignalReady() {
    const result = await ensureOutboundSignalLifecycleReadyFn({
      outboundSignalBlockedReason: state.outboundSignalBlockedReason,
      userId: state.userId,
      userNpub: state.userNpub,
      deviceId: state.deviceId,
      reconcileLocalDeviceRegistrationFn: signalIdentityRuntime.reconcileLocalDeviceRegistration,
      confirmPublishedLocalDeviceRegistrationFn: signalIdentityRuntime.confirmPublishedLocalDeviceRegistration,
      uploadSignedBundleFn: signalBundleRuntime.uploadSignedBundle,
      runKeyMaintenanceNowFn: signalMaintenanceRuntime.runKeyMaintenanceNow,
      scheduleKeyMaintenanceFn: signalMaintenanceRuntime.scheduleKeyMaintenance,
    });
    state.deviceId = Number(result?.deviceId) || state.deviceId;
    state.outboundSignalBlockedReason =
      result?.outboundSignalBlockedReason ?? state.outboundSignalBlockedReason;
    return result;
  }

  async function doInit(authData, options = {}) {
    const result = await initializeSignalLifecycleFn({
      authData,
      allowDeferredBundleAttestation: options?.allowDeferredBundleAttestation === true,
      signalCrypto,
      currentDeviceId: state.deviceId,
      reconcileLocalDeviceRegistrationFn: signalIdentityRuntime.reconcileLocalDeviceRegistration,
      confirmPublishedLocalDeviceRegistrationFn: signalIdentityRuntime.confirmPublishedLocalDeviceRegistration,
      uploadSignedBundleFn: signalBundleRuntime.uploadSignedBundle,
      resetEncryptionKeysFn,
      isDeferredBundleAttestationErrorFn,
      runKeyMaintenanceNowFn: signalMaintenanceRuntime.runKeyMaintenanceNow,
      scheduleKeyMaintenanceFn: signalMaintenanceRuntime.scheduleKeyMaintenance,
      clearRemoteIdentityCacheFn: () => remoteIdentityCache.clear(),
      clearSessionBootstrapRecipientsFn: () => sessionBootstrapRecipients.clear(),
    });
    state.initialized = result.initialized === true;
    state.userId = result.userId;
    state.userNpub = result.userNpub;
    state.deviceId = Number(result.deviceId) || state.deviceId;
    state.outboundSignalBlockedReason = result.outboundSignalBlockedReason ?? null;
    return result;
  }

  async function initializeSignalCrypto(authData, options = {}) {
    if (state.initialized && state.userId === authData?.userId) {
      return undefined;
    }
    if (state.initPromise) {
      return state.initPromise;
    }
    state.initPromise = doInit(authData, options).finally(() => {
      state.initPromise = null;
    });
    return state.initPromise;
  }

  async function destroySignalCrypto() {
    const result = await destroySignalLifecycleFn({
      maintenanceInterval: state.maintenanceInterval,
      signalCrypto,
      clearRemoteIdentityCacheFn: () => remoteIdentityCache.clear(),
      clearSessionBootstrapRecipientsFn: () => sessionBootstrapRecipients.clear(),
    });
    state.maintenanceInterval = result.maintenanceInterval;
    state.initialized = result.initialized;
    state.userId = result.userId;
    state.deviceId = result.deviceId;
    state.userNpub = result.userNpub;
    state.initPromise = result.initPromise;
    state.outboundSignalBlockedReason = result.outboundSignalBlockedReason;
    return result;
  }

  function isSignalInitialized() {
    return state.initialized;
  }

  function getSignalUserId() {
    return state.userId;
  }

  function getSignalDeviceId() {
    return state.deviceId;
  }

  async function ensureVerifiedSession(recipientId, recipientDeviceId = 1, identityRecord = null) {
    return ensureSignalMessageSessionFn({
      recipientId,
      recipientDeviceId,
      identityRecord,
      currentUserId: state.userId,
      sessionBootstrapRecipients,
      requireTrustedNpubFn: signalIdentityRuntime.requireTrustedNpub,
      getAddressKeyFn,
      hasSessionFn: (userId, deviceId) => signalCrypto?.hasSession?.(userId, deviceId),
      verifyAndApproveIdentityFn: signalIdentityRuntime.verifyAndApproveIdentity,
      fetchVerifiedIdentityFn: signalIdentityRuntime.fetchVerifiedIdentity,
      bootstrapSessionFromVerifiedBundleFn: signalIdentityRuntime.bootstrapSessionFromVerifiedBundle,
    });
  }

  return {
    sessionBootstrapRecipients,
    getAddressKey: getAddressKeyFn,
    ensureOutboundSignalReady,
    initializeSignalCrypto,
    destroySignalCrypto,
    isSignalInitialized,
    getSignalUserId,
    getSignalDeviceId,
    ensureVerifiedSession,
  };
}
