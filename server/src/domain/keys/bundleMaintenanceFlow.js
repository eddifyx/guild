const {
  buildCountResponse,
  getReplenishLimitError,
  shouldMirrorLegacyRows,
} = require('./bundleFlow');

function getBundleKeyCount({
  userId = null,
  deviceId = null,
  countAvailableKeysFn = () => null,
  countAvailableDeviceKeysFn = () => null,
} = {}) {
  return deviceId
    ? countAvailableDeviceKeysFn(userId, deviceId)
    : countAvailableKeysFn(userId);
}

function replenishOneTimePreKeys({
  userId = null,
  deviceId = null,
  oneTimePreKeys = null,
  countAvailableKeysFn = () => null,
  countAvailableDeviceKeysFn = () => null,
  insertOneTimePreKeyFn = () => {},
  insertDeviceOneTimePreKeyFn = () => {},
  isValidBase64KeyRangeFn = () => true,
} = {}) {
  if (!oneTimePreKeys || !Array.isArray(oneTimePreKeys)) {
    return { ok: false, status: 400, error: 'oneTimePreKeys array required' };
  }

  const currentCount = getBundleKeyCount({
    userId,
    deviceId,
    countAvailableKeysFn,
    countAvailableDeviceKeysFn,
  });
  const limitError = getReplenishLimitError({
    currentCount: currentCount ? currentCount.count : 0,
    incomingCount: oneTimePreKeys.length,
    replenishMax: 200,
    totalMax: 500,
    label: 'OTPs',
  });
  if (limitError) {
    return { ok: false, status: 400, error: limitError };
  }

  for (const otk of oneTimePreKeys) {
    if (!otk?.keyId || !otk?.publicKey) continue;
    if (!isValidBase64KeyRangeFn(otk.publicKey, 32, 33)) continue;
    if (!deviceId || shouldMirrorLegacyRows(deviceId)) {
      insertOneTimePreKeyFn(userId, otk.keyId, otk.publicKey);
    }
    if (deviceId) {
      insertDeviceOneTimePreKeyFn(userId, deviceId, otk.keyId, otk.publicKey);
    }
  }

  const result = getBundleKeyCount({
    userId,
    deviceId,
    countAvailableKeysFn,
    countAvailableDeviceKeysFn,
  });
  return {
    ok: true,
    body: {
      success: true,
      ...buildCountResponse(result),
    },
  };
}

function replenishKyberPreKeys({
  userId = null,
  deviceId = null,
  kyberPreKeys = null,
  countAvailableKeysFn = () => null,
  countAvailableDeviceKeysFn = () => null,
  insertKyberPreKeyFn = () => {},
  insertDeviceKyberPreKeyFn = () => {},
} = {}) {
  if (!kyberPreKeys || !Array.isArray(kyberPreKeys)) {
    return { ok: false, status: 400, error: 'kyberPreKeys array required' };
  }

  const currentCount = getBundleKeyCount({
    userId,
    deviceId,
    countAvailableKeysFn,
    countAvailableDeviceKeysFn,
  });
  const limitError = getReplenishLimitError({
    currentCount: currentCount ? currentCount.count : 0,
    incomingCount: kyberPreKeys.length,
    replenishMax: 50,
    totalMax: 100,
    label: 'Kyber prekeys',
  });
  if (limitError) {
    return { ok: false, status: 400, error: limitError };
  }

  for (const key of kyberPreKeys) {
    if (!key?.keyId || !key?.publicKey || !key?.signature) continue;
    if (!deviceId || shouldMirrorLegacyRows(deviceId)) {
      insertKyberPreKeyFn(userId, key.keyId, key.publicKey, key.signature);
    }
    if (deviceId) {
      insertDeviceKyberPreKeyFn(userId, deviceId, key.keyId, key.publicKey, key.signature);
    }
  }

  const result = getBundleKeyCount({
    userId,
    deviceId,
    countAvailableKeysFn,
    countAvailableDeviceKeysFn,
  });
  return {
    ok: true,
    body: {
      success: true,
      ...buildCountResponse(result),
    },
  };
}

module.exports = {
  getBundleKeyCount,
  replenishKyberPreKeys,
  replenishOneTimePreKeys,
};
