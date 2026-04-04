function createKeysRouteControllerModel(dbApi = {}) {
  function callGetter(statement, ...args) {
    if (typeof statement?.get === 'function') {
      return statement.get(...args) || null;
    }
    if (typeof statement === 'function') {
      return statement(...args) || null;
    }
    return null;
  }

  function getUserById(userId) {
    return callGetter(dbApi.getUserById, userId);
  }

  function getIdentityKey(userId) {
    return callGetter(dbApi.getIdentityKey, userId);
  }

  function getDeviceIdentityKey(userId, deviceId) {
    return callGetter(dbApi.getDeviceIdentityKey, userId, deviceId);
  }

  function getUserDeviceIdentityKeys(userId) {
    return dbApi.getUserDeviceIdentityKeys?.all?.(userId) || [];
  }

  function getLatestSignedPreKey(userId) {
    return callGetter(dbApi.getLatestSignedPreKey, userId);
  }

  function getLatestDeviceSignedPreKey(userId, deviceId) {
    return callGetter(dbApi.getLatestDeviceSignedPreKey, userId, deviceId);
  }

  function getAndClaimOneTimePreKey(userId) {
    return callGetter(dbApi.getAndClaimOneTimePreKey, userId);
  }

  function getAndClaimDeviceOneTimePreKey(userId, deviceId) {
    return callGetter(dbApi.getAndClaimDeviceOneTimePreKey, userId, deviceId);
  }

  function getAndClaimKyberPreKey(userId) {
    return callGetter(dbApi.getAndClaimKyberPreKey, userId);
  }

  function getAndClaimDeviceKyberPreKey(userId, deviceId) {
    return callGetter(dbApi.getAndClaimDeviceKyberPreKey, userId, deviceId);
  }

  function countAvailableOTPs(userId) {
    return callGetter(dbApi.countAvailableOTPs, userId);
  }

  function countAvailableDeviceOTPs(userId, deviceId) {
    return callGetter(dbApi.countAvailableDeviceOTPs, userId, deviceId);
  }

  function countAvailableKyberPreKeys(userId) {
    return callGetter(dbApi.countAvailableKyberPreKeys, userId);
  }

  function countAvailableDeviceKyberPreKeys(userId, deviceId) {
    return callGetter(dbApi.countAvailableDeviceKyberPreKeys, userId, deviceId);
  }

  function upsertIdentityKey(userId, identityKey, signingKey, registrationId, bundleSignatureEvent) {
    return dbApi.upsertIdentityKey?.run?.(userId, identityKey, signingKey, registrationId, bundleSignatureEvent);
  }

  function upsertDeviceIdentityKey(userId, deviceId, identityKey, signingKey, registrationId, bundleSignatureEvent) {
    return dbApi.upsertDeviceIdentityKey?.run?.(userId, deviceId, identityKey, signingKey, registrationId, bundleSignatureEvent);
  }

  function upsertSignedPreKey(userId, keyId, publicKey, signature) {
    return dbApi.upsertSignedPreKey?.run?.(userId, keyId, publicKey, signature);
  }

  function upsertDeviceSignedPreKey(userId, deviceId, keyId, publicKey, signature) {
    return dbApi.upsertDeviceSignedPreKey?.run?.(userId, deviceId, keyId, publicKey, signature);
  }

  function insertOneTimePreKey(userId, keyId, publicKey) {
    return dbApi.insertOneTimePreKey?.run?.(userId, keyId, publicKey);
  }

  function insertDeviceOneTimePreKey(userId, deviceId, keyId, publicKey) {
    return dbApi.insertDeviceOneTimePreKey?.run?.(userId, deviceId, keyId, publicKey);
  }

  function insertKyberPreKey(userId, keyId, publicKey, signature) {
    return dbApi.insertKyberPreKey?.run?.(userId, keyId, publicKey, signature);
  }

  function insertDeviceKyberPreKey(userId, deviceId, keyId, publicKey, signature) {
    return dbApi.insertDeviceKyberPreKey?.run?.(userId, deviceId, keyId, publicKey, signature);
  }

  function resetUserKeys(userId) {
    return dbApi.resetUserKeys?.run?.(userId);
  }

  return {
    getUserById,
    getIdentityKey,
    getDeviceIdentityKey,
    getUserDeviceIdentityKeys,
    getLatestSignedPreKey,
    getLatestDeviceSignedPreKey,
    getAndClaimOneTimePreKey,
    getAndClaimDeviceOneTimePreKey,
    getAndClaimKyberPreKey,
    getAndClaimDeviceKyberPreKey,
    countAvailableOTPs,
    countAvailableDeviceOTPs,
    countAvailableKyberPreKeys,
    countAvailableDeviceKyberPreKeys,
    upsertIdentityKey,
    upsertDeviceIdentityKey,
    upsertSignedPreKey,
    upsertDeviceSignedPreKey,
    insertOneTimePreKey,
    insertDeviceOneTimePreKey,
    insertKyberPreKey,
    insertDeviceKyberPreKey,
    resetUserKeys,
  };
}

module.exports = {
  createKeysRouteControllerModel,
};
