export async function resolveStableLocalSignalBundle({
  getBundleFn,
  getStableBundleFn,
} = {}) {
  const bundle = await getBundleFn?.();
  return getStableBundleFn?.(bundle);
}

export async function loadOrCreateSignalBundleAttestation({
  userId,
  npub,
  stableBundle,
  forceRefresh = false,
  loadCachedBundleAttestationFn,
  signBundleAttestationFn,
  storeBundleAttestationFn,
} = {}) {
  if (!forceRefresh) {
    const cached = loadCachedBundleAttestationFn?.(userId, stableBundle, npub);
    if (cached) {
      return cached;
    }
  }

  const signed = await signBundleAttestationFn?.(stableBundle);
  storeBundleAttestationFn?.(userId, signed);
  return signed;
}

export async function uploadSignedSignalBundle({
  authData,
  deviceId = 1,
  forceFreshAttestation = false,
  getBundleFn,
  getStableBundleFn,
  getLocalBundleAttestationFn,
  uploadPreKeyBundleFn,
} = {}) {
  const fullBundle = await getBundleFn?.();
  const stableBundle = getStableBundleFn?.(fullBundle);
  const bundleSignatureEvent = await getLocalBundleAttestationFn?.(authData, stableBundle, {
    forceRefresh: forceFreshAttestation,
  });
  const uploadDeviceId = Number(deviceId) || Number(fullBundle?.deviceId) || 1;

  await uploadPreKeyBundleFn?.({
    ...fullBundle,
    bundleSignatureEvent,
  }, uploadDeviceId);
}
