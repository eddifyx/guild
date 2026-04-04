function runBundleTransaction(dbTransactionFn, operation) {
  const transactionResult = dbTransactionFn(operation);
  if (typeof transactionResult === 'function') {
    return transactionResult();
  }
  return transactionResult;
}

function persistValidatedBundleUpload({
  userId = null,
  deviceId = 1,
  identityKey = null,
  storedSigningKey = null,
  registrationId = null,
  signedPreKey = null,
  oneTimePreKeys = null,
  kyberPreKey = null,
  kyberPreKeys = null,
  bundleSignatureEvent = null,
  isV2 = false,
  mirrorLegacyRows = false,
  replaceServerPreKeys = false,
  dbTransactionFn = (callback) => callback(),
  deleteUserOneTimePreKeysFn = () => {},
  deleteUserKyberPreKeysFn = () => {},
  deleteUserSignedPreKeysFn = () => {},
  deleteDeviceOneTimePreKeysFn = () => {},
  deleteDeviceKyberPreKeysFn = () => {},
  deleteDeviceSignedPreKeysFn = () => {},
  upsertIdentityKeyFn = () => {},
  upsertDeviceIdentityKeyFn = () => {},
  upsertSignedPreKeyFn = () => {},
  upsertDeviceSignedPreKeyFn = () => {},
  insertOneTimePreKeyFn = () => {},
  insertDeviceOneTimePreKeyFn = () => {},
  insertKyberPreKeyFn = () => {},
  insertDeviceKyberPreKeyFn = () => {},
  isValidBase64KeyRangeFn = () => true,
} = {}) {
  runBundleTransaction(dbTransactionFn, () => {
    if (replaceServerPreKeys) {
      if (mirrorLegacyRows) {
        deleteUserOneTimePreKeysFn(userId);
        deleteUserKyberPreKeysFn(userId);
        deleteUserSignedPreKeysFn(userId);
      }
      deleteDeviceOneTimePreKeysFn(userId, deviceId);
      deleteDeviceKyberPreKeysFn(userId, deviceId);
      deleteDeviceSignedPreKeysFn(userId, deviceId);
    }

    if (mirrorLegacyRows) {
      upsertIdentityKeyFn(
        userId,
        identityKey,
        storedSigningKey,
        registrationId,
        isV2 ? JSON.stringify(bundleSignatureEvent) : null,
      );
    }
    upsertDeviceIdentityKeyFn(
      userId,
      deviceId,
      identityKey,
      storedSigningKey,
      registrationId,
      isV2 ? JSON.stringify(bundleSignatureEvent) : null,
    );

    if (mirrorLegacyRows) {
      upsertSignedPreKeyFn(userId, signedPreKey.keyId, signedPreKey.publicKey, signedPreKey.signature);
    }
    upsertDeviceSignedPreKeyFn(
      userId,
      deviceId,
      signedPreKey.keyId,
      signedPreKey.publicKey,
      signedPreKey.signature,
    );

    if (Array.isArray(oneTimePreKeys) && oneTimePreKeys.length > 0) {
      const minKeySize = isV2 ? 32 : 32;
      const maxKeySize = isV2 ? 33 : 32;
      for (const otk of oneTimePreKeys) {
        if (!otk?.keyId || !otk?.publicKey) continue;
        if (!isValidBase64KeyRangeFn(otk.publicKey, minKeySize, maxKeySize)) continue;
        if (mirrorLegacyRows) {
          insertOneTimePreKeyFn(userId, otk.keyId, otk.publicKey);
        }
        insertDeviceOneTimePreKeyFn(userId, deviceId, otk.keyId, otk.publicKey);
      }
    }

    if (kyberPreKey) {
      if (mirrorLegacyRows) {
        insertKyberPreKeyFn(userId, kyberPreKey.keyId, kyberPreKey.publicKey, kyberPreKey.signature);
      }
      insertDeviceKyberPreKeyFn(
        userId,
        deviceId,
        kyberPreKey.keyId,
        kyberPreKey.publicKey,
        kyberPreKey.signature,
      );
    }

    if (Array.isArray(kyberPreKeys)) {
      for (const key of kyberPreKeys) {
        if (!key?.keyId || !key?.publicKey || !key?.signature) continue;
        if (mirrorLegacyRows) {
          insertKyberPreKeyFn(userId, key.keyId, key.publicKey, key.signature);
        }
        insertDeviceKyberPreKeyFn(userId, deviceId, key.keyId, key.publicKey, key.signature);
      }
    }
  });

  return {
    success: true,
  };
}

function resetBundleKeys({
  userId = null,
  resetUserKeysFn = () => {},
} = {}) {
  resetUserKeysFn(userId);
  return { success: true };
}

module.exports = {
  persistValidatedBundleUpload,
  resetBundleKeys,
  runBundleTransaction,
};
