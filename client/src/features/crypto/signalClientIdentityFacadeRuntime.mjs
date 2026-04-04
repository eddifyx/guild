export function createSignalClientIdentityFacadeRuntime({
  signalCrypto = null,
  fetchDeviceIdentityRecordsCachedFn = async () => [],
  validateIdentityAttestationFn = async () => true,
  reconcileAttestedIdentityFn = async () => true,
  loadRemoteIdentityVerificationStateFn = async () => null,
} = {}) {
  async function hasSession(recipientId, recipientDeviceId = 1) {
    return signalCrypto?.hasSession?.(recipientId, recipientDeviceId);
  }

  async function deleteSession(recipientId, recipientDeviceId = 1) {
    return signalCrypto?.deleteSession?.(recipientId, recipientDeviceId);
  }

  async function getIdentityStatus(recipientId, recipientDeviceId = 1, identityKey = null) {
    return signalCrypto?.getIdentityState?.(recipientId, recipientDeviceId, identityKey);
  }

  async function loadRemoteIdentityVerification(recipientId) {
    return loadRemoteIdentityVerificationStateFn({
      recipientId,
      fetchDeviceIdentityRecordsCachedFn,
      validateIdentityAttestationFn,
      reconcileAttestedIdentityFn,
    });
  }

  async function approveIdentity(recipientId, identityKey, options, recipientDeviceId = 1) {
    return signalCrypto?.approveIdentity?.(recipientId, recipientDeviceId, identityKey, options);
  }

  async function markIdentityVerified(recipientId, identityKey, recipientDeviceId = 1) {
    return signalCrypto?.markIdentityVerified?.(recipientId, recipientDeviceId, identityKey);
  }

  async function getFingerprint(theirUserId, theirIdentityKey) {
    return signalCrypto?.getFingerprint?.(theirUserId, theirIdentityKey);
  }

  return {
    hasSession,
    deleteSession,
    getIdentityStatus,
    loadRemoteIdentityVerification,
    approveIdentity,
    markIdentityVerified,
    getFingerprint,
  };
}
