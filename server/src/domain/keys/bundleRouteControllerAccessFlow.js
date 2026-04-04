const {
  canAccessUserKeys,
  consumeBundleRouteRateLimit,
} = require('./bundleRouteFlow');

const BUNDLE_RATE_WINDOW = 60_000;
const BUNDLE_RATE_MAX = 10;
const TARGET_RATE_WINDOW = 60_000;
const TARGET_RATE_MAX = 20;

function createKeysRouteControllerAccessFlow({
  dbApi = {},
  nowFn = () => Date.now(),
  bundleRateLimit = new Map(),
  targetRateLimit = new Map(),
  bundleWindowMs = BUNDLE_RATE_WINDOW,
  bundleMaxCount = BUNDLE_RATE_MAX,
  targetWindowMs = TARGET_RATE_WINDOW,
  targetMaxCount = TARGET_RATE_MAX,
} = {}) {
  function purgeExpiredRateLimits(now = nowFn()) {
    for (const [key, value] of bundleRateLimit) {
      if (now >= value.resetTime) bundleRateLimit.delete(key);
    }
    for (const [key, value] of targetRateLimit) {
      if (now >= value.resetTime) targetRateLimit.delete(key);
    }
  }

  function getVisibleGuildmateIds(userId) {
    return dbApi.listVisibleGuildmateIds?.all?.(userId) || [];
  }

  function getVisibleContactUserIds(userId) {
    return dbApi.listVisibleContactUserIds?.all?.(userId) || [];
  }

  function canRequesterAccessUserKeys(requesterUserId, targetUserId) {
    return canAccessUserKeys({
      requesterUserId,
      targetUserId,
      listVisibleGuildmateIdsFn: getVisibleGuildmateIds,
      listVisibleContactUserIdsFn: getVisibleContactUserIds,
    });
  }

  function consumeBundleAccess(requesterUserId, targetUserId, targetDeviceId) {
    const now = nowFn();
    purgeExpiredRateLimits(now);
    return consumeBundleRouteRateLimit({
      bundleRateLimit,
      targetRateLimit,
      requesterUserId,
      targetUserId,
      targetDeviceId,
      now,
      bundleWindowMs,
      bundleMaxCount,
      targetWindowMs,
      targetMaxCount,
    });
  }

  return {
    canRequesterAccessUserKeys,
    consumeBundleAccess,
  };
}

module.exports = {
  createKeysRouteControllerAccessFlow,
};
