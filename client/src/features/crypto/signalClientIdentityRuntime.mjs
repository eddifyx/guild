import {
  confirmPublishedLocalDeviceRegistration as confirmPublishedLocalDeviceRegistrationRuntime,
  fetchVerifiedIdentityRecord,
  fetchVerifiedPreKeyBundleRecord,
  isPublishedLocalDeviceRegistration as isPublishedLocalDeviceRegistrationRuntime,
  listVerifiedDevicesForUser as listVerifiedDevicesForUserRuntime,
  listVerifiedSiblingDevicesBestEffort as listVerifiedSiblingDevicesBestEffortRuntime,
  reconcileLocalSignalDeviceRegistration,
} from './signalIdentityRuntime.mjs';
import {
  reconcileSignalAttestedIdentity,
  validateSignalIdentityAttestation,
  verifyAndApproveSignalIdentity,
} from './signalTrustRuntime.mjs';
import { bootstrapSignalSessionFromVerifiedBundle } from './signalSessionRuntime.mjs';

export function createSignalClientIdentityRuntime({
  getCurrentUserIdFn = () => null,
  getCurrentUserNpubFn = () => null,
  getCurrentDeviceIdFn = () => 1,
  getKnownNpubFn,
  getStableBundleFn,
  verifyBundleAttestationFn,
  fetchDeviceIdentityRecordsFn,
  fetchDeviceIdentityRecordsCachedFn,
  fetchPreKeyBundleFn,
  getStableLocalBundleFn,
  signalCrypto,
} = {}) {
  async function resolveExpectedNpub(userId) {
    const currentUserId = getCurrentUserIdFn?.();
    const currentUserNpub = getCurrentUserNpubFn?.();

    if (userId === currentUserId && currentUserNpub) {
      return currentUserNpub;
    }

    const known = getKnownNpubFn?.(userId);
    if (known) {
      return known;
    }

    const err = new Error('Secure messaging is waiting for this contact\'s Nostr identity.');
    err.retryable = true;
    throw err;
  }

  async function requireTrustedNpub(userId, { quarantineSession = false } = {}) {
    try {
      return await resolveExpectedNpub(userId);
    } catch (err) {
      if (quarantineSession) {
        try {
          await signalCrypto?.deleteSession?.(userId);
        } catch {}
      }
      throw err;
    }
  }

  async function validateIdentityAttestation(userId, identityRecord) {
    return validateSignalIdentityAttestation({
      userId,
      identityRecord,
      resolveExpectedNpubFn: resolveExpectedNpub,
      getStableBundleFn,
      verifyBundleAttestationFn,
    });
  }

  async function reconcileAttestedIdentity(userId, deviceId, identityKey) {
    return reconcileSignalAttestedIdentity({
      userId,
      deviceId,
      identityKey,
      getIdentityStateFn: (targetUserId, targetDeviceId, targetIdentityKey) =>
        signalCrypto?.getIdentityState?.(targetUserId, targetDeviceId, targetIdentityKey),
      deleteSessionFn: (targetUserId, targetDeviceId) =>
        signalCrypto?.deleteSession?.(targetUserId, targetDeviceId),
      approveIdentityFn: (targetUserId, targetDeviceId, targetIdentityKey, options) =>
        signalCrypto?.approveIdentity?.(targetUserId, targetDeviceId, targetIdentityKey, options),
    });
  }

  async function verifyAndApproveIdentity(userId, deviceId, identityRecord) {
    return verifyAndApproveSignalIdentity({
      userId,
      deviceId,
      identityRecord,
      validateIdentityAttestationFn: validateIdentityAttestation,
      reconcileAttestedIdentityFn: reconcileAttestedIdentity,
    });
  }

  async function reconcileLocalDeviceRegistration(authData, currentDeviceId) {
    return reconcileLocalSignalDeviceRegistration({
      authData,
      currentDeviceId,
      getStableLocalBundleFn,
      fetchDeviceIdentityRecordsFn,
      setDeviceIdFn: (deviceId) => signalCrypto?.setDeviceId?.(deviceId),
      allocateDeviceIdFn: (excludedDeviceIds) => signalCrypto?.allocateDeviceId?.(excludedDeviceIds),
    });
  }

  async function confirmPublishedLocalDeviceRegistration(authData, currentDeviceId) {
    return confirmPublishedLocalDeviceRegistrationRuntime({
      authData,
      currentDeviceId,
      getStableLocalBundleFn,
      fetchDeviceIdentityRecordsFn,
    });
  }

  async function fetchVerifiedIdentity(userId, deviceId = 1) {
    return fetchVerifiedIdentityRecord({
      userId,
      deviceId,
      currentUserId: getCurrentUserIdFn?.(),
      fetchDeviceIdentityRecordsCachedFn,
      validateIdentityAttestationFn: validateIdentityAttestation,
      verifyAndApproveIdentityFn: verifyAndApproveIdentity,
    });
  }

  async function fetchVerifiedPreKeyBundle(userId, deviceId = 1) {
    return fetchVerifiedPreKeyBundleRecord({
      userId,
      deviceId,
      currentUserId: getCurrentUserIdFn?.(),
      fetchPreKeyBundleFn,
      validateIdentityAttestationFn: validateIdentityAttestation,
      verifyAndApproveIdentityFn: verifyAndApproveIdentity,
    });
  }

  async function bootstrapSessionFromVerifiedBundle(recipientId, recipientDeviceId = 1, { force = false } = {}) {
    return bootstrapSignalSessionFromVerifiedBundle({
      recipientId,
      recipientDeviceId,
      currentUserId: getCurrentUserIdFn?.(),
      force,
      fetchVerifiedPreKeyBundleFn: fetchVerifiedPreKeyBundle,
      deleteSessionFn: (userId, deviceId) => signalCrypto?.deleteSession?.(userId, deviceId),
      approveIdentityFn: (userId, deviceId, identityKey, options) =>
        signalCrypto?.approveIdentity?.(userId, deviceId, identityKey, options),
      processBundleFn: (userId, deviceId, bundle) =>
        signalCrypto?.processBundle?.(userId, deviceId, bundle),
    });
  }

  async function listVerifiedDevicesForUser(userId, options = {}) {
    return listVerifiedDevicesForUserRuntime({
      userId,
      currentUserId: getCurrentUserIdFn?.(),
      currentDeviceId: getCurrentDeviceIdFn?.(),
      fetchDeviceIdentityRecordsCachedFn,
      validateIdentityAttestationFn: validateIdentityAttestation,
      verifyAndApproveIdentityFn: verifyAndApproveIdentity,
      ...options,
    });
  }

  async function listVerifiedSiblingDevicesBestEffort() {
    return listVerifiedSiblingDevicesBestEffortRuntime({
      currentUserId: getCurrentUserIdFn?.(),
      listVerifiedDevicesForUserFn: (userId, options) => listVerifiedDevicesForUser(userId, options),
    });
  }

  return {
    resolveExpectedNpub,
    requireTrustedNpub,
    validateIdentityAttestation,
    reconcileAttestedIdentity,
    verifyAndApproveIdentity,
    reconcileLocalDeviceRegistration,
    confirmPublishedLocalDeviceRegistration,
    isPublishedLocalDeviceRegistration: isPublishedLocalDeviceRegistrationRuntime,
    fetchVerifiedIdentity,
    fetchVerifiedPreKeyBundle,
    bootstrapSessionFromVerifiedBundle,
    listVerifiedDevicesForUser,
    listVerifiedSiblingDevicesBestEffort,
  };
}
