export async function validateSignalIdentityAttestation({
  userId,
  identityRecord,
  resolveExpectedNpubFn,
  getStableBundleFn,
  verifyBundleAttestationFn,
} = {}) {
  const expectedNpub = await resolveExpectedNpubFn?.(userId);
  const stableBundle = getStableBundleFn?.(identityRecord);

  if (!identityRecord?.bundleSignatureEvent) {
    throw new Error('Remote Signal identity is missing a Nostr attestation');
  }

  if (!verifyBundleAttestationFn?.(stableBundle, identityRecord.bundleSignatureEvent, expectedNpub)) {
    throw new Error('Remote Signal identity attestation is invalid');
  }

  return { expectedNpub, stableBundle };
}

export async function reconcileSignalAttestedIdentity({
  userId,
  deviceId,
  identityKey,
  getIdentityStateFn,
  deleteSessionFn,
  approveIdentityFn,
} = {}) {
  let trustState = await getIdentityStateFn?.(userId, deviceId, identityKey);
  const rotated = trustState?.status === 'key_changed';

  if (rotated) {
    await deleteSessionFn?.(userId, deviceId);
    await approveIdentityFn?.(userId, deviceId, identityKey, { verified: false });
    trustState = await getIdentityStateFn?.(userId, deviceId, identityKey);
  } else if (trustState?.status !== 'trusted') {
    await approveIdentityFn?.(userId, deviceId, identityKey, { verified: false });
    trustState = await getIdentityStateFn?.(userId, deviceId, identityKey);
  }

  return {
    status: trustState?.status || 'trusted',
    verified: !!trustState?.verified,
    rotated,
  };
}

export async function verifyAndApproveSignalIdentity({
  userId,
  deviceId,
  identityRecord,
  validateIdentityAttestationFn,
  reconcileAttestedIdentityFn,
} = {}) {
  const { stableBundle } = await validateIdentityAttestationFn?.(userId, identityRecord);
  const trustState = await reconcileAttestedIdentityFn?.(
    userId,
    deviceId,
    stableBundle.identityKey,
  );

  return {
    ...stableBundle,
    deviceId,
    trustState: trustState?.status,
    verified: !!trustState?.verified,
    rotated: !!trustState?.rotated,
  };
}
