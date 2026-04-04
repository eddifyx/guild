const {
  getRequestedDeviceId,
  shouldMirrorLegacyRows,
} = require('./bundleFlow');
const {
  persistValidatedBundleUpload,
} = require('./bundleWriteFlow');
const {
  isValidBase64KeyRange,
  validateBundleUploadRequest,
} = require('./bundleUploadFlow');
const { createStatementRunner } = require('./bundleRouteControllerRuntime');

function createKeysRouteControllerUploadFlow({
  dbApi = {},
  model = {},
  verifyBundleAttestationEventFn = () => true,
} = {}) {
  const db = dbApi.db || null;
  const deleteUserOneTimePreKeys = createStatementRunner(db, 'DELETE FROM one_time_prekeys WHERE user_id = ?', 'deleteUserOneTimePreKeys');
  const deleteUserKyberPreKeys = createStatementRunner(db, 'DELETE FROM kyber_prekeys WHERE user_id = ?', 'deleteUserKyberPreKeys');
  const deleteUserSignedPreKeys = createStatementRunner(db, 'DELETE FROM signed_prekeys WHERE user_id = ?', 'deleteUserSignedPreKeys');
  const deleteDeviceOneTimePreKeys = createStatementRunner(db, 'DELETE FROM signal_device_one_time_prekeys WHERE user_id = ? AND device_id = ?', 'deleteDeviceOneTimePreKeys');
  const deleteDeviceKyberPreKeys = createStatementRunner(db, 'DELETE FROM signal_device_kyber_prekeys WHERE user_id = ? AND device_id = ?', 'deleteDeviceKyberPreKeys');
  const deleteDeviceSignedPreKeys = createStatementRunner(db, 'DELETE FROM signal_device_signed_prekeys WHERE user_id = ? AND device_id = ?', 'deleteDeviceSignedPreKeys');

  async function handleUploadBundle(req, res) {
    const userId = req.userId;
    const deviceId = getRequestedDeviceId(req) || 1;
    const mirrorLegacyRows = shouldMirrorLegacyRows(deviceId);
    const bundleValidation = await validateBundleUploadRequest({
      userId,
      body: req.body,
      existingLegacyIdentity: model.getIdentityKey(userId),
      userNpub: model.getUserById(userId)?.npub || null,
      verifyBundleAttestationEventFn,
    });

    if (!bundleValidation.ok) {
      return res.status(bundleValidation.status).json({ error: bundleValidation.error });
    }

    const { isV2, storedSigningKey, replaceServerPreKeys } = bundleValidation.value;
    const persistResult = persistValidatedBundleUpload({
      userId,
      deviceId,
      identityKey: req.body.identityKey,
      storedSigningKey,
      registrationId: req.body.registrationId,
      signedPreKey: req.body.signedPreKey,
      oneTimePreKeys: req.body.oneTimePreKeys,
      kyberPreKey: req.body.kyberPreKey,
      kyberPreKeys: req.body.kyberPreKeys,
      bundleSignatureEvent: req.body.bundleSignatureEvent,
      isV2,
      mirrorLegacyRows,
      replaceServerPreKeys,
      dbTransactionFn: db?.transaction ? db.transaction.bind(db) : (callback) => callback(),
      deleteUserOneTimePreKeysFn: deleteUserOneTimePreKeys,
      deleteUserKyberPreKeysFn: deleteUserKyberPreKeys,
      deleteUserSignedPreKeysFn: deleteUserSignedPreKeys,
      deleteDeviceOneTimePreKeysFn: deleteDeviceOneTimePreKeys,
      deleteDeviceKyberPreKeysFn: deleteDeviceKyberPreKeys,
      deleteDeviceSignedPreKeysFn: deleteDeviceSignedPreKeys,
      upsertIdentityKeyFn: model.upsertIdentityKey,
      upsertDeviceIdentityKeyFn: model.upsertDeviceIdentityKey,
      upsertSignedPreKeyFn: model.upsertSignedPreKey,
      upsertDeviceSignedPreKeyFn: model.upsertDeviceSignedPreKey,
      insertOneTimePreKeyFn: model.insertOneTimePreKey,
      insertDeviceOneTimePreKeyFn: model.insertDeviceOneTimePreKey,
      insertKyberPreKeyFn: model.insertKyberPreKey,
      insertDeviceKyberPreKeyFn: model.insertDeviceKyberPreKey,
      isValidBase64KeyRangeFn: isValidBase64KeyRange,
    });

    return res.json(persistResult);
  }

  return {
    handleUploadBundle,
  };
}

module.exports = {
  createKeysRouteControllerUploadFlow,
};
