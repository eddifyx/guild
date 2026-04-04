const {
  buildDeviceIdentityResponse,
  buildLegacyDeviceResponse,
  consumeRateLimitBucket,
} = require('./bundleFlow');
const {
  buildVisibleUserIdSet,
  canAccessVisibleUser,
} = require('../users/visibility');

function canAccessUserKeys({
  requesterUserId = null,
  targetUserId = null,
  listVisibleGuildmateIdsFn = () => [],
  listVisibleContactUserIdsFn = () => [],
} = {}) {
  const visibleUserIds = buildVisibleUserIdSet({
    requesterUserId,
    guildmateRows: listVisibleGuildmateIdsFn(requesterUserId) || [],
    contactRows: listVisibleContactUserIdsFn(requesterUserId) || [],
  });

  return canAccessVisibleUser({
    requesterUserId,
    targetUserId,
    visibleUserIds,
  });
}

function consumeBundleRouteRateLimit({
  bundleRateLimit = new Map(),
  targetRateLimit = new Map(),
  requesterUserId = null,
  targetUserId = null,
  targetDeviceId = null,
  now = Date.now(),
  bundleWindowMs = 60_000,
  bundleMaxCount = 10,
  targetWindowMs = 60_000,
  targetMaxCount = 20,
  consumeRateLimitBucketFn = consumeRateLimitBucket,
} = {}) {
  const targetKey = targetDeviceId ? `${targetUserId}:${targetDeviceId}` : targetUserId;
  const targetBucket = consumeRateLimitBucketFn(targetRateLimit, targetKey, now, {
    windowMs: targetWindowMs,
    maxCount: targetMaxCount,
  });
  if (!targetBucket.allowed) {
    return {
      ok: false,
      status: 429,
      error: targetDeviceId
        ? 'Too many bundle requests for this device. Try again later.'
        : 'Too many bundle requests for this user. Try again later.',
    };
  }

  const requesterKey = targetDeviceId
    ? `${requesterUserId}:${targetUserId}:${targetDeviceId}`
    : `${requesterUserId}:${targetUserId}`;
  const requesterBucket = consumeRateLimitBucketFn(bundleRateLimit, requesterKey, now, {
    windowMs: bundleWindowMs,
    maxCount: bundleMaxCount,
  });
  if (!requesterBucket.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'Too many bundle requests. Try again later.',
    };
  }

  return { ok: true };
}

function buildIdentityResponses({
  targetUserId = null,
  deviceRows = [],
  getLatestDeviceSignedPreKeyFn = () => null,
  getIdentityKeyFn = () => null,
  getLatestSignedPreKeyFn = () => null,
} = {}) {
  const responses = [];

  for (const identity of deviceRows || []) {
    const signedPreKey = getLatestDeviceSignedPreKeyFn(targetUserId, identity.device_id);
    if (!signedPreKey) continue;
    responses.push(buildDeviceIdentityResponse(identity, signedPreKey));
  }

  if (!responses.some((entry) => entry.deviceId === 1)) {
    const identity = getIdentityKeyFn(targetUserId);
    const signedPreKey = getLatestSignedPreKeyFn(targetUserId);
    const legacy = buildLegacyDeviceResponse(identity, signedPreKey);
    if (legacy) {
      responses.push(buildDeviceIdentityResponse(
        {
          device_id: legacy.deviceId,
          identity_key_public: legacy.identityKey,
          signing_key_public: legacy.signingKey,
          registration_id: legacy.registrationId,
          bundle_signature_event: legacy.bundleSignatureEvent ? JSON.stringify(legacy.bundleSignatureEvent) : null,
        },
        {
          key_id: legacy.signedPreKey.keyId,
          public_key: legacy.signedPreKey.publicKey,
          signature: legacy.signedPreKey.signature,
        },
      ));
    }
  }

  return responses.sort((a, b) => a.deviceId - b.deviceId);
}

module.exports = {
  buildIdentityResponses,
  canAccessUserKeys,
  consumeBundleRouteRateLimit,
};
