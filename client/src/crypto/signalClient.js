/**
 * /guild E2E Encryption - Signal Client (v2 IPC Wrapper)
 *
 * Thin async wrapper around window.signalCrypto exposed by preload.js.
 * All key material stays in the Electron main process (Rust native memory).
 * The renderer only sends plaintext and receives opaque ciphertext blobs.
 */

import {
  uploadPreKeyBundle,
  fetchPreKeyBundle,
  fetchIdentityAttestation,
  fetchDeviceIdentityRecords,
  getOTPCount as apiGetOTPCount,
  getKyberCount as apiGetKyberCount,
  replenishOTPs as apiReplenishOTPs,
  replenishKyberPreKeys as apiReplenishKyber,
  resetEncryptionKeys,
} from '../api.js';
import {
  loadCachedBundleAttestation,
  signBundleAttestation,
  storeBundleAttestation,
  verifyBundleAttestation,
} from './bundleAttestation.js';
import { getKnownNpub } from './identityDirectory.js';
import {
  buildDirectMessageEnvelopePayload,
  buildDirectMessageTargets,
  getAddressKey,
  getStableBundle,
  isDeferredBundleAttestationError,
} from '../features/crypto/signalIdentityModel.mjs';
import { createSignalClientFacadeRuntime } from '../features/crypto/signalClientFacadeRuntime.mjs';

const signalClientRuntime = createSignalClientFacadeRuntime({
  signalCrypto: window.signalCrypto,
  uploadPreKeyBundleFn: uploadPreKeyBundle,
  fetchPreKeyBundleFn: fetchPreKeyBundle,
  fetchIdentityAttestationFn: fetchIdentityAttestation,
  fetchDeviceIdentityRecordsFn: fetchDeviceIdentityRecords,
  getOTPCountFn: apiGetOTPCount,
  getKyberCountFn: apiGetKyberCount,
  replenishOTPsUploadFn: apiReplenishOTPs,
  replenishKyberUploadFn: apiReplenishKyber,
  resetEncryptionKeysFn: resetEncryptionKeys,
  loadCachedBundleAttestationFn: loadCachedBundleAttestation,
  signBundleAttestationFn: signBundleAttestation,
  storeBundleAttestationFn: storeBundleAttestation,
  verifyBundleAttestationFn: verifyBundleAttestation,
  getKnownNpubFn: getKnownNpub,
  buildDirectMessageEnvelopePayloadFn: buildDirectMessageEnvelopePayload,
  buildDirectMessageTargetsFn: buildDirectMessageTargets,
  getAddressKeyFn: getAddressKey,
  getStableBundleFn: getStableBundle,
  isDeferredBundleAttestationErrorFn: isDeferredBundleAttestationError,
});

export const initializeSignalCrypto = signalClientRuntime.initializeSignalCrypto;
export const destroySignalCrypto = signalClientRuntime.destroySignalCrypto;
export const resetSignalLocalState = (userId = null) => window.signalCrypto?.resetLocalState?.(userId);
export const isSignalInitialized = signalClientRuntime.isSignalInitialized;
export const getSignalUserId = signalClientRuntime.getSignalUserId;
export const getSignalDeviceId = signalClientRuntime.getSignalDeviceId;
export const signalEncrypt = signalClientRuntime.signalEncrypt;
export const signalDecrypt = signalClientRuntime.signalDecrypt;
export const hasSession = signalClientRuntime.hasSession;
export const deleteSession = signalClientRuntime.deleteSession;
export const getIdentityStatus = signalClientRuntime.getIdentityStatus;
export const loadRemoteIdentityVerification = signalClientRuntime.loadRemoteIdentityVerification;
export const approveIdentity = signalClientRuntime.approveIdentity;
export const markIdentityVerified = signalClientRuntime.markIdentityVerified;
export const buildDirectMessageEnvelope = signalClientRuntime.buildDirectMessageEnvelope;
export const createSKDM = signalClientRuntime.createSKDM;
export const processSKDM = signalClientRuntime.processSKDM;
export const groupEncrypt = signalClientRuntime.groupEncrypt;
export const groupDecrypt = signalClientRuntime.groupDecrypt;
export const rekeyRoom = signalClientRuntime.rekeyRoom;
export const getFingerprint = signalClientRuntime.getFingerprint;
