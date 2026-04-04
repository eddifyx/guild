export function isDeferredBundleAttestationError(err) {
  const message = err?.message || String(err || '');
  return /Signal identity attestation|Timed out waiting for Signal bundle attestation signature|Nostr signer unavailable for Signal identity attestation/i.test(message);
}

export function getStableBundle(identityRecord = {}) {
  return {
    identityKey: identityRecord.identityKey,
    registrationId: identityRecord.registrationId,
    signedPreKey: identityRecord.signedPreKey,
  };
}

export function buildLocalRegistrationResult(deviceId, localBundle, extras = {}) {
  return {
    deviceId,
    localBundle,
    canUploadBundle: true,
    uploadBlockReason: null,
    ...extras,
  };
}

export function normalizeIdentityRecords(identities) {
  if (!Array.isArray(identities)) return [];
  return identities.map((identity) => ({
    ...identity,
    deviceId: Number(identity?.deviceId) || 1,
  }));
}

export function getNormalizedIdentityDeviceIds(identities = []) {
  return normalizeIdentityRecords(identities)
    .map((identity) => Number(identity?.deviceId))
    .filter((deviceId) => Number.isInteger(deviceId) && deviceId > 0);
}

export function hasConflictingDeviceRegistration(identities = [], deviceId, localBundle) {
  const normalizedDeviceId = Number(deviceId) || 1;
  return normalizeIdentityRecords(identities).some((identity) => (
    Number(identity?.deviceId) === normalizedDeviceId
    && identity?.identityKey
    && identity.identityKey !== localBundle.identityKey
  ));
}

export function selectIdentityRecord(identities, deviceId = 1) {
  const normalized = normalizeIdentityRecords(identities);
  if (normalized.length === 0) return null;
  return normalized.find((identity) => Number(identity?.deviceId) === Number(deviceId))
    || normalized[0]
    || null;
}

export function getAddressKey(userId, deviceId = 1) {
  return `${userId}:${deviceId}`;
}

export function buildDirectMessageTargets({
  recipientId,
  recipientDevices = [],
  selfDevices = [],
  currentUserId,
} = {}) {
  const targets = [];
  const seen = new Set();

  const addTargets = (userId, devices) => {
    for (const identity of normalizeIdentityRecords(devices)) {
      const addressKey = getAddressKey(userId, identity.deviceId);
      if (seen.has(addressKey)) continue;
      seen.add(addressKey);
      targets.push({
        userId,
        deviceId: identity.deviceId,
        identity,
      });
    }
  };

  addTargets(recipientId, recipientDevices);
  addTargets(currentUserId, selfDevices);

  return targets;
}

export function buildDirectMessageEnvelopePayload({
  recipientId,
  senderDeviceId = 1,
  copies = [],
} = {}) {
  if (!Array.isArray(copies) || copies.length === 0) {
    throw new Error('No trusted devices are available for this DM.');
  }

  const normalizedSenderDeviceId = Number(senderDeviceId) || 1;
  const legacyRecipientCopy = normalizedSenderDeviceId === 1
    ? copies.find((copy) => (
        copy?.recipientUserId === recipientId
        && Number(copy?.recipientDeviceId) === 1
      )) || null
    : null;

  return {
    v: legacyRecipientCopy ? 2 : 3,
    senderDeviceId: normalizedSenderDeviceId,
    ...(legacyRecipientCopy ? {
      type: legacyRecipientCopy.type,
      payload: legacyRecipientCopy.payload,
    } : {}),
    copies,
  };
}
