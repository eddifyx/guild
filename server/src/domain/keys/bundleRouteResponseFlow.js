const { buildCountResponse } = require('./bundleFlow');
const { buildIdentityResponses } = require('./bundleRouteFlow');
const {
  fetchDeviceBundleForRead,
  fetchPreferredUserBundle,
  fetchStableIdentityRecord,
} = require('./bundleReadFlow');
const { getBundleKeyCount } = require('./bundleMaintenanceFlow');

function buildOkRouteResponse(body) {
  return { ok: true, body };
}

function buildNotFoundRouteResponse(error) {
  return {
    ok: false,
    status: 404,
    error,
  };
}

function buildIdentityResponsesRouteResult({
  targetUserId = null,
  deviceRows = [],
  getLatestDeviceSignedPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
} = {}) {
  const responses = buildIdentityResponses({
    targetUserId,
    deviceRows,
    getLatestDeviceSignedPreKeyFn,
    getIdentityKeyFn,
    getLatestSignedPreKeyFn,
  });

  if (!responses.length) {
    return buildNotFoundRouteResponse('User has no encryption identities');
  }

  return buildOkRouteResponse(responses);
}

function buildDeviceBundleRouteResult({
  targetUserId = null,
  targetDeviceId = null,
  getDeviceIdentityKeyFn = () => null,
  getLatestDeviceSignedPreKeyFn = () => null,
  getAndClaimDeviceOneTimePreKeyFn = () => null,
  getAndClaimDeviceKyberPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
  getAndClaimOneTimePreKeyFn = () => null,
  getAndClaimKyberPreKeyFn = () => null,
} = {}) {
  const bundle = fetchDeviceBundleForRead({
    targetUserId,
    targetDeviceId,
    getDeviceIdentityKeyFn,
    getLatestDeviceSignedPreKeyFn,
    getAndClaimDeviceOneTimePreKeyFn,
    getAndClaimDeviceKyberPreKeyFn,
    getIdentityKeyFn,
    getLatestSignedPreKeyFn,
    getAndClaimOneTimePreKeyFn,
    getAndClaimKyberPreKeyFn,
  });

  if (!bundle) {
    return buildNotFoundRouteResponse('Device has no encryption bundle');
  }

  return buildOkRouteResponse(bundle);
}

function buildPreferredUserBundleRouteResult({
  targetUserId = null,
  getUserDeviceIdentityKeysFn = () => [],
  getLatestDeviceSignedPreKeyFn = () => null,
  getAndClaimDeviceOneTimePreKeyFn = () => null,
  getAndClaimDeviceKyberPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
  getAndClaimOneTimePreKeyFn = () => null,
  getAndClaimKyberPreKeyFn = () => null,
} = {}) {
  const bundle = fetchPreferredUserBundle({
    targetUserId,
    getUserDeviceIdentityKeysFn,
    getLatestDeviceSignedPreKeyFn,
    getAndClaimDeviceOneTimePreKeyFn,
    getAndClaimDeviceKyberPreKeyFn,
    getIdentityKeyFn,
    getLatestSignedPreKeyFn,
    getAndClaimOneTimePreKeyFn,
    getAndClaimKyberPreKeyFn,
  });

  if (!bundle) {
    return buildNotFoundRouteResponse('User has no encryption keys');
  }

  return buildOkRouteResponse(bundle);
}

function buildStableIdentityRecordRouteResult({
  targetUserId = null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
} = {}) {
  const record = fetchStableIdentityRecord({
    targetUserId,
    getIdentityKeyFn,
    getLatestSignedPreKeyFn,
  });

  if (!record) {
    return buildNotFoundRouteResponse('User has no signed prekey');
  }

  return buildOkRouteResponse(record);
}

function buildCountRouteResult({
  userId = null,
  deviceId = null,
  countAvailableKeysFn = () => null,
  countAvailableDeviceKeysFn = () => null,
} = {}) {
  const result = getBundleKeyCount({
    userId,
    deviceId,
    countAvailableKeysFn,
    countAvailableDeviceKeysFn,
  });

  return buildOkRouteResponse(buildCountResponse(result));
}

module.exports = {
  buildCountRouteResult,
  buildDeviceBundleRouteResult,
  buildIdentityResponsesRouteResult,
  buildPreferredUserBundleRouteResult,
  buildStableIdentityRecordRouteResult,
};
