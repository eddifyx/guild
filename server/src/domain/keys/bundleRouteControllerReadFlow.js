const {
  normalizeDeviceId,
} = require('./bundleFlow');
const {
  buildDeviceBundleRouteResult,
  buildIdentityResponsesRouteResult,
  buildPreferredUserBundleRouteResult,
  buildStableIdentityRecordRouteResult,
} = require('./bundleRouteResponseFlow');
const { sendRouteResult } = require('./bundleRouteControllerRuntime');

function createKeysRouteControllerReadFlow({
  model = {},
  accessFlow = {},
} = {}) {
  const {
    canRequesterAccessUserKeys = () => false,
    consumeBundleAccess = () => ({ ok: false, status: 403, error: 'Forbidden' }),
  } = accessFlow;

  function handleDeviceIdentities(req, res) {
    const targetUserId = req.params.userId;
    if (!canRequesterAccessUserKeys(req.userId, targetUserId)) {
      return res.status(403).json({ error: 'You can only fetch encryption identities for visible users' });
    }

    const responses = buildIdentityResponsesRouteResult({
      targetUserId,
      deviceRows: model.getUserDeviceIdentityKeys(targetUserId),
      getLatestDeviceSignedPreKeyFn: model.getLatestDeviceSignedPreKey,
      getIdentityKeyFn: model.getIdentityKey,
      getLatestSignedPreKeyFn: model.getLatestSignedPreKey,
    });

    return sendRouteResult(res, responses);
  }

  function handleDeviceBundle(req, res) {
    const targetUserId = req.params.userId;
    const targetDeviceId = normalizeDeviceId(req.params.deviceId);

    if (!targetDeviceId) {
      return res.status(400).json({ error: 'Invalid deviceId' });
    }

    if (!canRequesterAccessUserKeys(req.userId, targetUserId)) {
      return res.status(403).json({ error: 'You can only fetch encryption bundles for visible users' });
    }

    const rateLimitResult = consumeBundleAccess(req.userId, targetUserId, targetDeviceId);
    if (!rateLimitResult.ok) {
      return res.status(rateLimitResult.status).json({ error: rateLimitResult.error });
    }

    const bundle = buildDeviceBundleRouteResult({
      targetUserId,
      targetDeviceId,
      getDeviceIdentityKeyFn: model.getDeviceIdentityKey,
      getLatestDeviceSignedPreKeyFn: model.getLatestDeviceSignedPreKey,
      getAndClaimDeviceOneTimePreKeyFn: model.getAndClaimDeviceOneTimePreKey,
      getAndClaimDeviceKyberPreKeyFn: model.getAndClaimDeviceKyberPreKey,
      getIdentityKeyFn: model.getIdentityKey,
      getLatestSignedPreKeyFn: model.getLatestSignedPreKey,
      getAndClaimOneTimePreKeyFn: model.getAndClaimOneTimePreKey,
      getAndClaimKyberPreKeyFn: model.getAndClaimKyberPreKey,
    });

    return sendRouteResult(res, bundle);
  }

  function handlePreferredUserBundle(req, res) {
    const targetUserId = req.params.userId;
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot fetch own prekey bundle' });
    }

    if (!canRequesterAccessUserKeys(req.userId, targetUserId)) {
      return res.status(403).json({ error: 'You can only fetch encryption bundles for visible users' });
    }

    const rateLimitResult = consumeBundleAccess(req.userId, targetUserId, null);
    if (!rateLimitResult.ok) {
      return res.status(rateLimitResult.status).json({ error: rateLimitResult.error });
    }

    const bundle = buildPreferredUserBundleRouteResult({
      targetUserId,
      getUserDeviceIdentityKeysFn: model.getUserDeviceIdentityKeys,
      getLatestDeviceSignedPreKeyFn: model.getLatestDeviceSignedPreKey,
      getAndClaimDeviceOneTimePreKeyFn: model.getAndClaimDeviceOneTimePreKey,
      getAndClaimDeviceKyberPreKeyFn: model.getAndClaimDeviceKyberPreKey,
      getIdentityKeyFn: model.getIdentityKey,
      getLatestSignedPreKeyFn: model.getLatestSignedPreKey,
      getAndClaimOneTimePreKeyFn: model.getAndClaimOneTimePreKey,
      getAndClaimKyberPreKeyFn: model.getAndClaimKyberPreKey,
    });

    return sendRouteResult(res, bundle);
  }

  function handleStableIdentityRecord(req, res) {
    const targetUserId = req.params.userId;
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot fetch own identity record' });
    }

    if (!canRequesterAccessUserKeys(req.userId, targetUserId)) {
      return res.status(403).json({ error: 'You can only fetch identity records for visible users' });
    }

    const identityRecord = buildStableIdentityRecordRouteResult({
      targetUserId,
      getIdentityKeyFn: model.getIdentityKey,
      getLatestSignedPreKeyFn: model.getLatestSignedPreKey,
    });

    return sendRouteResult(res, identityRecord);
  }

  return {
    handleDeviceIdentities,
    handleDeviceBundle,
    handlePreferredUserBundle,
    handleStableIdentityRecord,
  };
}

module.exports = {
  createKeysRouteControllerReadFlow,
};
