const {
  buildDeviceBundleResponse,
  buildDeviceIdentityResponse,
  buildLegacyDeviceResponse,
  selectPreferredBundleDevice,
} = require('./bundleFlow');

function fetchDeviceBundleForRead({
  targetUserId,
  targetDeviceId,
  getDeviceIdentityKeyFn = () => null,
  getLatestDeviceSignedPreKeyFn = () => null,
  getAndClaimDeviceOneTimePreKeyFn = () => null,
  getAndClaimDeviceKyberPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
  getAndClaimOneTimePreKeyFn = () => null,
  getAndClaimKyberPreKeyFn = () => null,
} = {}) {
  const deviceIdentity = getDeviceIdentityKeyFn(targetUserId, targetDeviceId);
  const deviceSignedPreKey = getLatestDeviceSignedPreKeyFn(targetUserId, targetDeviceId);
  if (deviceIdentity && deviceSignedPreKey) {
    return buildDeviceBundleResponse(
      deviceIdentity,
      deviceSignedPreKey,
      getAndClaimDeviceOneTimePreKeyFn(targetUserId, targetDeviceId),
      getAndClaimDeviceKyberPreKeyFn(targetUserId, targetDeviceId),
    );
  }

  if (targetDeviceId === 1) {
    return buildLegacyDeviceResponse(
      getIdentityKeyFn(targetUserId),
      getLatestSignedPreKeyFn(targetUserId),
      getAndClaimOneTimePreKeyFn(targetUserId),
      getAndClaimKyberPreKeyFn(targetUserId),
    );
  }

  return null;
}

function fetchPreferredUserBundle({
  targetUserId,
  getUserDeviceIdentityKeysFn = () => [],
  getLatestDeviceSignedPreKeyFn = () => null,
  getAndClaimDeviceOneTimePreKeyFn = () => null,
  getAndClaimDeviceKyberPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
  getAndClaimOneTimePreKeyFn = () => null,
  getAndClaimKyberPreKeyFn = () => null,
} = {}) {
  const fallbackDevice = selectPreferredBundleDevice(getUserDeviceIdentityKeysFn(targetUserId) || []);
  if (fallbackDevice) {
    const signedPreKey = getLatestDeviceSignedPreKeyFn(targetUserId, fallbackDevice.device_id);
    if (signedPreKey) {
      return buildDeviceBundleResponse(
        fallbackDevice,
        signedPreKey,
        getAndClaimDeviceOneTimePreKeyFn(targetUserId, fallbackDevice.device_id),
        getAndClaimDeviceKyberPreKeyFn(targetUserId, fallbackDevice.device_id),
      );
    }
  }

  return buildLegacyDeviceResponse(
    getIdentityKeyFn(targetUserId),
    getLatestSignedPreKeyFn(targetUserId),
    getAndClaimOneTimePreKeyFn(targetUserId),
    getAndClaimKyberPreKeyFn(targetUserId),
  );
}

function fetchStableIdentityRecord({
  targetUserId,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
} = {}) {
  const identity = getIdentityKeyFn(targetUserId);
  const signedPreKey = getLatestSignedPreKeyFn(targetUserId);
  if (!identity || !signedPreKey) return null;

  return buildDeviceIdentityResponse(
    {
      ...identity,
      device_id: 1,
    },
    signedPreKey,
  );
}

module.exports = {
  fetchDeviceBundleForRead,
  fetchPreferredUserBundle,
  fetchStableIdentityRecord,
};
