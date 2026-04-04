import {
  buildLocalRegistrationResult,
  getNormalizedIdentityDeviceIds,
  hasConflictingDeviceRegistration,
  normalizeIdentityRecords,
  selectIdentityRecord,
} from './signalIdentityModel.mjs';

export const SIGNAL_REMOTE_IDENTITY_CACHE_TTL_MS = 10000;

export function createRemoteIdentityCacheLoader({
  remoteIdentityCache,
  fetchDeviceIdentityRecordsFn,
  fetchIdentityAttestationFn,
  ttlMs = SIGNAL_REMOTE_IDENTITY_CACHE_TTL_MS,
} = {}) {
  return async function fetchDeviceIdentityRecordsCached(userId, { force = false, allowLegacyFallback = true } = {}) {
    const cached = remoteIdentityCache.get(userId);
    const now = Date.now();

    if (!force && cached?.value && cached.expiresAt > now) {
      return cached.value;
    }

    if (!force && cached?.promise) {
      return cached.promise;
    }

    const promise = fetchDeviceIdentityRecordsFn(userId)
      .then((identities) => {
        const normalized = normalizeIdentityRecords(identities);
        remoteIdentityCache.set(userId, {
          value: normalized,
          expiresAt: Date.now() + ttlMs,
        });
        return normalized;
      })
      .catch(async (err) => {
        if (!allowLegacyFallback) {
          if (remoteIdentityCache.get(userId)?.promise === promise) {
            remoteIdentityCache.delete(userId);
          }
          throw err;
        }

        try {
          const identity = await fetchIdentityAttestationFn(userId);
          const normalized = normalizeIdentityRecords([{ ...identity, deviceId: 1 }]);
          remoteIdentityCache.set(userId, {
            value: normalized,
            expiresAt: Date.now() + ttlMs,
          });
          return normalized;
        } catch (fallbackErr) {
          if (remoteIdentityCache.get(userId)?.promise === promise) {
            remoteIdentityCache.delete(userId);
          }
          throw fallbackErr || err;
        }
      });

    remoteIdentityCache.set(userId, { promise });
    return promise;
  };
}

export async function reconcileLocalSignalDeviceRegistration({
  authData,
  currentDeviceId,
  getStableLocalBundleFn,
  fetchDeviceIdentityRecordsFn,
  setDeviceIdFn,
  allocateDeviceIdFn,
  logWarnFn = console.warn,
} = {}) {
  const localBundle = await getStableLocalBundleFn();

  let identities = [];
  try {
    identities = await fetchDeviceIdentityRecordsFn(authData.userId);
  } catch (error) {
    logWarnFn(
      '[Signal] Device registration check unavailable; secure send is paused until it succeeds:',
      error?.message || error,
    );
    return buildLocalRegistrationResult(currentDeviceId, localBundle, {
      canUploadBundle: false,
      uploadBlockReason: 'Secure messaging is waiting for a device identity check. Please reconnect and try again.',
    });
  }

  const normalizedIdentities = normalizeIdentityRecords(identities);
  if (normalizedIdentities.length === 0) {
    return buildLocalRegistrationResult(currentDeviceId, localBundle);
  }

  const hasOnlyLegacyDeviceRegistration = normalizedIdentities.every(
    (identity) => Number(identity?.deviceId) === 1,
  );
  if (hasOnlyLegacyDeviceRegistration && Number(currentDeviceId) !== 1) {
    const adoptedLegacyDeviceId = Number(await setDeviceIdFn(1)) || 1;
    return buildLocalRegistrationResult(adoptedLegacyDeviceId, localBundle);
  }

  const matchingIdentity = normalizedIdentities.find(
    (identity) => identity?.identityKey === localBundle.identityKey,
  );

  if (matchingIdentity) {
    const matchingDeviceId = Number(matchingIdentity.deviceId) || currentDeviceId || 1;
    if (matchingDeviceId !== currentDeviceId) {
      const adoptedDeviceId = Number(await setDeviceIdFn(matchingDeviceId)) || matchingDeviceId;
      return buildLocalRegistrationResult(adoptedDeviceId, localBundle);
    }
    return buildLocalRegistrationResult(currentDeviceId, localBundle);
  }

  const conflictingCurrentDevice = hasConflictingDeviceRegistration(
    normalizedIdentities,
    currentDeviceId,
    localBundle,
  );
  if (!conflictingCurrentDevice) {
    return buildLocalRegistrationResult(currentDeviceId, localBundle);
  }

  const excludedDeviceIds = getNormalizedIdentityDeviceIds(normalizedIdentities);
  const allocatedDeviceId = Number(await allocateDeviceIdFn(excludedDeviceIds)) || currentDeviceId;
  return buildLocalRegistrationResult(allocatedDeviceId, localBundle);
}

export function isPublishedLocalDeviceRegistration({
  identities = [],
  deviceId = 1,
  localBundle = null,
} = {}) {
  if (!localBundle?.identityKey) {
    return false;
  }

  const normalizedDeviceId = Number(deviceId) || 1;
  const matchingIdentity = normalizeIdentityRecords(identities).find(
    (identity) => Number(identity?.deviceId) === normalizedDeviceId,
  );

  if (!matchingIdentity || matchingIdentity.identityKey !== localBundle.identityKey) {
    return false;
  }

  const localRegistrationId = Number(localBundle?.registrationId);
  const remoteRegistrationId = Number(matchingIdentity?.registrationId);
  if (Number.isInteger(localRegistrationId) && Number.isInteger(remoteRegistrationId)
    && localRegistrationId !== remoteRegistrationId) {
    return false;
  }

  const localSignedPreKey = localBundle?.signedPreKey?.publicKey || null;
  const remoteSignedPreKey = matchingIdentity?.signedPreKey?.publicKey || null;
  if (localSignedPreKey && remoteSignedPreKey && localSignedPreKey !== remoteSignedPreKey) {
    return false;
  }

  return true;
}

export async function confirmPublishedLocalDeviceRegistration({
  authData,
  currentDeviceId,
  getStableLocalBundleFn,
  fetchDeviceIdentityRecordsFn,
} = {}) {
  const localBundle = await getStableLocalBundleFn?.();
  const identities = normalizeIdentityRecords(await fetchDeviceIdentityRecordsFn?.(authData?.userId));

  return {
    deviceId: Number(currentDeviceId) || 1,
    localBundle,
    identities,
    published: isPublishedLocalDeviceRegistration({
      identities,
      deviceId: currentDeviceId,
      localBundle,
    }),
  };
}

export async function fetchVerifiedIdentityRecord({
  userId,
  deviceId = 1,
  currentUserId = null,
  fetchDeviceIdentityRecordsCachedFn,
  validateIdentityAttestationFn,
  verifyAndApproveIdentityFn,
} = {}) {
  const identities = await fetchDeviceIdentityRecordsCachedFn(userId, {
    allowLegacyFallback: userId !== currentUserId,
  });
  const identity = selectIdentityRecord(identities, deviceId);
  if (!identity) {
    throw new Error('Remote Signal identity not found for requested device');
  }
  if (userId === currentUserId) {
    await validateIdentityAttestationFn(userId, identity);
    return identity;
  }
  await verifyAndApproveIdentityFn(userId, Number(identity.deviceId) || deviceId || 1, identity);
  return identity;
}

export async function fetchVerifiedPreKeyBundleRecord({
  userId,
  deviceId = 1,
  currentUserId = null,
  fetchPreKeyBundleFn,
  validateIdentityAttestationFn,
  verifyAndApproveIdentityFn,
} = {}) {
  const bundle = await fetchPreKeyBundleFn(userId, deviceId);
  const normalizedDeviceId = Number(bundle?.deviceId) || Number(deviceId) || 1;
  if (userId === currentUserId) {
    await validateIdentityAttestationFn(userId, bundle);
    return bundle;
  }
  await verifyAndApproveIdentityFn(userId, normalizedDeviceId, bundle);
  return bundle;
}

export async function loadRemoteIdentityVerificationState({
  recipientId,
  fetchDeviceIdentityRecordsCachedFn,
  validateIdentityAttestationFn,
  reconcileAttestedIdentityFn,
} = {}) {
  const identities = await fetchDeviceIdentityRecordsCachedFn(recipientId);
  const identity = selectIdentityRecord(identities, 1);
  if (!identity) {
    throw new Error('Remote Signal identity not found');
  }
  const { stableBundle, expectedNpub } = await validateIdentityAttestationFn(recipientId, identity);
  const trustState = await reconcileAttestedIdentityFn(
    recipientId,
    Number(identity.deviceId) || 1,
    stableBundle.identityKey,
  );

  return {
    identity,
    deviceId: Number(identity.deviceId) || 1,
    identityKey: stableBundle.identityKey,
    stableBundle,
    expectedNpub,
    trustState,
  };
}

export async function listVerifiedDevicesForUser({
  userId,
  currentUserId = null,
  currentDeviceId = 1,
  fetchDeviceIdentityRecordsCachedFn,
  validateIdentityAttestationFn,
  verifyAndApproveIdentityFn,
  includeCurrentDevice = false,
  forceRefresh = false,
  logWarnFn = console.warn,
} = {}) {
  const identities = await fetchDeviceIdentityRecordsCachedFn(userId, {
    force: forceRefresh,
    allowLegacyFallback: userId !== currentUserId,
  });
  const devices = [];

  for (const identity of normalizeIdentityRecords(identities)) {
    const deviceId = Number(identity?.deviceId) || 1;
    if (!includeCurrentDevice && userId === currentUserId && deviceId === currentDeviceId) {
      continue;
    }
    try {
      if (userId === currentUserId) {
        await validateIdentityAttestationFn(userId, identity);
        devices.push({ ...identity, deviceId });
        continue;
      }
      await verifyAndApproveIdentityFn(userId, deviceId, identity);
      devices.push({ ...identity, deviceId });
    } catch (err) {
      logWarnFn('[Signal] Skipping untrusted device identity:', userId, deviceId, err?.message || err);
    }
  }

  return devices;
}

export async function listVerifiedSiblingDevicesBestEffort({
  currentUserId = null,
  listVerifiedDevicesForUserFn,
  logWarnFn = console.warn,
} = {}) {
  try {
    return await listVerifiedDevicesForUserFn(currentUserId, { forceRefresh: true });
  } catch (err) {
    logWarnFn('[Signal] Skipping self-device DM fanout until sibling identities are available:', err?.message || err);
    return [];
  }
}
