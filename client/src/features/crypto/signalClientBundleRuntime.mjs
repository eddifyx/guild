import {
  loadOrCreateSignalBundleAttestation,
  resolveStableLocalSignalBundle,
  uploadSignedSignalBundle,
} from './signalBundleRuntime.mjs';

export function createSignalClientBundleRuntime({
  getCurrentDeviceIdFn = () => 1,
  getBundleFn = async () => null,
  getStableBundleFn,
  loadCachedBundleAttestationFn,
  signBundleAttestationFn,
  storeBundleAttestationFn,
  uploadPreKeyBundleFn,
  otpCountFn,
  replenishOTPsFn,
  kyberCountFn,
  replenishKyberFn,
  otpThreshold = 20,
  kyberThreshold = 5,
  kyberBatchSize = 20,
  resolveStableLocalSignalBundleFn = resolveStableLocalSignalBundle,
  loadOrCreateSignalBundleAttestationFn = loadOrCreateSignalBundleAttestation,
  uploadSignedSignalBundleFn = uploadSignedSignalBundle,
} = {}) {
  async function getStableLocalBundle() {
    return resolveStableLocalSignalBundleFn({
      getBundleFn,
      getStableBundleFn,
    });
  }

  async function getLocalBundleAttestation(authData, stableBundle, { forceRefresh = false } = {}) {
    return loadOrCreateSignalBundleAttestationFn({
      userId: authData.userId,
      npub: authData.npub,
      stableBundle,
      forceRefresh,
      loadCachedBundleAttestationFn,
      signBundleAttestationFn,
      storeBundleAttestationFn,
    });
  }

  async function uploadSignedBundle(authData, { deviceId = null, forceFreshAttestation = false } = {}) {
    return uploadSignedSignalBundleFn({
      authData,
      deviceId: Number(deviceId) || Number(getCurrentDeviceIdFn?.()) || 1,
      forceFreshAttestation,
      otpThreshold,
      kyberThreshold,
      kyberBatchSize,
      otpCountFn,
      replenishOTPsFn,
      kyberCountFn,
      replenishKyberFn,
      getBundleFn,
      getStableBundleFn,
      getLocalBundleAttestationFn: getLocalBundleAttestation,
      uploadPreKeyBundleFn,
    });
  }

  return {
    getStableLocalBundle,
    getLocalBundleAttestation,
    uploadSignedBundle,
  };
}
