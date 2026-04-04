import test from 'node:test';
import assert from 'node:assert/strict';

import {
  confirmPublishedLocalDeviceRegistration,
  createRemoteIdentityCacheLoader,
  fetchVerifiedIdentityRecord,
  isPublishedLocalDeviceRegistration,
  listVerifiedDevicesForUser,
  loadRemoteIdentityVerificationState,
  reconcileLocalSignalDeviceRegistration,
} from '../../../client/src/features/crypto/signalIdentityRuntime.mjs';

test('signal identity runtime caches remote device identities and falls back to legacy attestation once', async () => {
  const remoteIdentityCache = new Map();
  let fetchCalls = 0;
  let fallbackCalls = 0;
  const fetchCached = createRemoteIdentityCacheLoader({
    remoteIdentityCache,
    fetchDeviceIdentityRecordsFn: async () => {
      fetchCalls += 1;
      throw new Error('new endpoint unavailable');
    },
    fetchIdentityAttestationFn: async (userId) => {
      fallbackCalls += 1;
      return { userId, identityKey: 'legacy-key', deviceId: 1 };
    },
  });

  const first = await fetchCached('user-2');
  const second = await fetchCached('user-2');

  assert.equal(fetchCalls, 1);
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(first, second);
  assert.equal(first[0].deviceId, 1);
});

test('signal identity runtime reconciles local device registration across adopt, allocate, and blocked paths', async () => {
  const localBundle = {
    identityKey: 'local-key',
    registrationId: 77,
    signedPreKey: 'signed-local',
  };

  const adopted = await reconcileLocalSignalDeviceRegistration({
    authData: { userId: 'user-1' },
    currentDeviceId: 1,
    getStableLocalBundleFn: async () => localBundle,
    fetchDeviceIdentityRecordsFn: async () => [{ deviceId: 4, identityKey: 'local-key' }],
    setDeviceIdFn: async (deviceId) => deviceId,
    allocateDeviceIdFn: async () => 99,
  });
  assert.equal(adopted.deviceId, 4);

  const allocated = await reconcileLocalSignalDeviceRegistration({
    authData: { userId: 'user-1' },
    currentDeviceId: 1,
    getStableLocalBundleFn: async () => localBundle,
    fetchDeviceIdentityRecordsFn: async () => [{ deviceId: 1, identityKey: 'remote-key' }],
    setDeviceIdFn: async (deviceId) => deviceId,
    allocateDeviceIdFn: async () => 7,
  });
  assert.equal(allocated.deviceId, 7);

  const blocked = await reconcileLocalSignalDeviceRegistration({
    authData: { userId: 'user-1' },
    currentDeviceId: 1,
    getStableLocalBundleFn: async () => localBundle,
    fetchDeviceIdentityRecordsFn: async () => {
      throw new Error('offline');
    },
    setDeviceIdFn: async (deviceId) => deviceId,
    allocateDeviceIdFn: async () => 7,
    logWarnFn: () => {},
  });
  assert.equal(blocked.canUploadBundle, false);
  assert.match(blocked.uploadBlockReason, /device identity check/i);
});

test('signal identity runtime snaps back to legacy device 1 when the server only knows the legacy registration', async () => {
  const localBundle = {
    identityKey: 'new-local-key',
    registrationId: 88,
    signedPreKey: 'signed-local',
  };

  const adopted = await reconcileLocalSignalDeviceRegistration({
    authData: { userId: 'user-1' },
    currentDeviceId: 127,
    getStableLocalBundleFn: async () => localBundle,
    fetchDeviceIdentityRecordsFn: async () => [{ deviceId: 1, identityKey: 'old-legacy-key' }],
    setDeviceIdFn: async (deviceId) => deviceId,
    allocateDeviceIdFn: async () => 7,
  });

  assert.equal(adopted.deviceId, 1);
  assert.equal(adopted.canUploadBundle, true);
});

test('signal identity runtime verifies remote identities and skips untrusted devices', async () => {
  const verified = await fetchVerifiedIdentityRecord({
    userId: 'user-2',
    deviceId: 3,
    currentUserId: 'user-1',
    fetchDeviceIdentityRecordsCachedFn: async () => [
      { deviceId: 3, identityKey: 'remote-3' },
      { deviceId: 4, identityKey: 'remote-4' },
    ],
    validateIdentityAttestationFn: async () => {
      throw new Error('should not validate self attestation here');
    },
    verifyAndApproveIdentityFn: async (_userId, _deviceId, identity) => identity,
  });

  assert.equal(verified.identityKey, 'remote-3');

  const listed = await listVerifiedDevicesForUser({
    userId: 'user-2',
    currentUserId: 'user-1',
    currentDeviceId: 1,
    fetchDeviceIdentityRecordsCachedFn: async () => [
      { deviceId: 2, identityKey: 'good-key' },
      { deviceId: 3, identityKey: 'bad-key' },
    ],
    validateIdentityAttestationFn: async () => {},
    verifyAndApproveIdentityFn: async (_userId, deviceId) => {
      if (deviceId === 3) {
        throw new Error('untrusted');
      }
    },
    logWarnFn: () => {},
  });

  assert.deepEqual(listed.map((device) => device.deviceId), [2]);
});

test('signal identity runtime loads remote verification state with the canonical trust payload', async () => {
  const result = await loadRemoteIdentityVerificationState({
    recipientId: 'user-2',
    fetchDeviceIdentityRecordsCachedFn: async () => [{ deviceId: 1, identityKey: 'remote-key' }],
    validateIdentityAttestationFn: async () => ({
      stableBundle: {
        identityKey: 'remote-key',
        registrationId: 99,
        signedPreKey: 'signed-key',
      },
      expectedNpub: 'npub-remote',
    }),
    reconcileAttestedIdentityFn: async () => ({
      status: 'trusted',
      verified: false,
      rotated: false,
    }),
  });

  assert.equal(result.deviceId, 1);
  assert.equal(result.identityKey, 'remote-key');
  assert.equal(result.expectedNpub, 'npub-remote');
  assert.deepEqual(result.trustState, {
    status: 'trusted',
    verified: false,
    rotated: false,
  });
});

test('signal identity runtime confirms when the published device bundle matches the local device', async () => {
  const localBundle = {
    identityKey: 'local-identity',
    registrationId: 77,
    signedPreKey: {
      publicKey: 'signed-local',
    },
  };

  assert.equal(isPublishedLocalDeviceRegistration({
    identities: [{
      deviceId: 22,
      identityKey: 'local-identity',
      registrationId: 77,
      signedPreKey: {
        publicKey: 'signed-local',
      },
    }],
    deviceId: 22,
    localBundle,
  }), true);

  const confirmation = await confirmPublishedLocalDeviceRegistration({
    authData: { userId: 'user-1' },
    currentDeviceId: 22,
    getStableLocalBundleFn: async () => localBundle,
    fetchDeviceIdentityRecordsFn: async () => [{
      deviceId: 22,
      identityKey: 'remote-identity',
      registrationId: 77,
      signedPreKey: {
        publicKey: 'signed-local',
      },
    }],
  });

  assert.equal(confirmation.deviceId, 22);
  assert.equal(confirmation.published, false);
  assert.equal(confirmation.identities.length, 1);
});
