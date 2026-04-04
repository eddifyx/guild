function parseBundleSignatureEvent(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeDeviceId(rawDeviceId) {
  const numeric = Number(rawDeviceId);
  if (!Number.isInteger(numeric) || numeric < 1) return null;
  return numeric;
}

function getRequestedDeviceId(req = {}) {
  return normalizeDeviceId(
    req.params?.deviceId
    ?? req.body?.deviceId
    ?? req.query?.deviceId,
  );
}

function shouldMirrorLegacyRows(deviceId) {
  return Number(deviceId) === 1;
}

function buildDeviceBundleResponse(
  identity,
  signedPreKey,
  oneTimePreKey = null,
  kyberPreKey = null,
) {
  if (!identity || !signedPreKey) return null;
  return {
    deviceId: identity.device_id,
    identityKey: identity.identity_key_public,
    signingKey: identity.signing_key_public,
    registrationId: identity.registration_id,
    bundleSignatureEvent: parseBundleSignatureEvent(identity.bundle_signature_event),
    signedPreKey: {
      keyId: signedPreKey.key_id,
      publicKey: signedPreKey.public_key,
      signature: signedPreKey.signature,
    },
    oneTimePreKey: oneTimePreKey ? {
      keyId: oneTimePreKey.key_id,
      publicKey: oneTimePreKey.public_key,
    } : null,
    kyberPreKey: kyberPreKey ? {
      keyId: kyberPreKey.key_id,
      publicKey: kyberPreKey.public_key,
      signature: kyberPreKey.signature,
    } : null,
  };
}

function buildLegacyDeviceResponse(
  identity,
  signedPreKey,
  oneTimePreKey = null,
  kyberPreKey = null,
) {
  const legacyIdentity = identity ? { ...identity, device_id: 1 } : null;
  return buildDeviceBundleResponse(
    legacyIdentity,
    signedPreKey,
    oneTimePreKey,
    kyberPreKey,
  );
}

function buildDeviceIdentityResponse(identity, signedPreKey) {
  const bundle = buildDeviceBundleResponse(identity, signedPreKey);
  if (!bundle) return null;
  return {
    deviceId: bundle.deviceId,
    identityKey: bundle.identityKey,
    signingKey: bundle.signingKey,
    registrationId: bundle.registrationId,
    bundleSignatureEvent: bundle.bundleSignatureEvent,
    signedPreKey: bundle.signedPreKey,
  };
}

function selectPreferredBundleDevice(deviceRows = []) {
  const preferredLegacyDevice = deviceRows.find((row) => Number(row?.device_id) === 1) || null;
  return preferredLegacyDevice || deviceRows[0] || null;
}

function consumeRateLimitBucket(rateLimitMap, bucketKey, now, {
  windowMs,
  maxCount,
} = {}) {
  const currentBucket = rateLimitMap.get(bucketKey);
  if (currentBucket && now < currentBucket.resetTime) {
    if (currentBucket.count >= maxCount) {
      return { allowed: false };
    }
    currentBucket.count += 1;
    return { allowed: true };
  }

  rateLimitMap.set(bucketKey, { count: 1, resetTime: now + windowMs });
  return { allowed: true };
}

function buildCountResponse(result) {
  return { count: result ? result.count : 0 };
}

function getReplenishLimitError({
  currentCount = 0,
  incomingCount = 0,
  replenishMax = 0,
  totalMax = 0,
  label = 'keys',
} = {}) {
  if (incomingCount > replenishMax) {
    return `Too many ${label} (max ${replenishMax})`;
  }
  if (currentCount + incomingCount > totalMax) {
    return `${label} limit exceeded (${currentCount} existing + ${incomingCount} new > ${totalMax} max)`;
  }
  return null;
}

module.exports = {
  buildCountResponse,
  buildDeviceBundleResponse,
  buildDeviceIdentityResponse,
  buildLegacyDeviceResponse,
  consumeRateLimitBucket,
  getReplenishLimitError,
  getRequestedDeviceId,
  normalizeDeviceId,
  parseBundleSignatureEvent,
  selectPreferredBundleDevice,
  shouldMirrorLegacyRows,
};
