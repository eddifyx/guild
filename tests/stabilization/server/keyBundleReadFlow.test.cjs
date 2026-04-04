const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchDeviceBundleForRead,
  fetchPreferredUserBundle,
  fetchStableIdentityRecord,
} = require('../../../server/src/domain/keys/bundleReadFlow');

test('bundle read flow prefers explicit device bundles before falling back to legacy rows', () => {
  const bundle = fetchDeviceBundleForRead({
    targetUserId: 'user-1',
    targetDeviceId: 2,
    getDeviceIdentityKeyFn: () => ({
      device_id: 2,
      identity_key_public: 'identity-2',
      signing_key_public: 'signing-2',
      registration_id: 22,
      bundle_signature_event: null,
    }),
    getLatestDeviceSignedPreKeyFn: () => ({
      key_id: 2,
      public_key: 'spk-2',
      signature: 'sig-2',
    }),
    getAndClaimDeviceOneTimePreKeyFn: () => ({
      key_id: 20,
      public_key: 'otp-2',
    }),
    getAndClaimDeviceKyberPreKeyFn: () => null,
  });

  assert.deepEqual(bundle, {
    deviceId: 2,
    identityKey: 'identity-2',
    signingKey: 'signing-2',
    registrationId: 22,
    bundleSignatureEvent: null,
    signedPreKey: {
      keyId: 2,
      publicKey: 'spk-2',
      signature: 'sig-2',
    },
    oneTimePreKey: {
      keyId: 20,
      publicKey: 'otp-2',
    },
    kyberPreKey: null,
  });
});

test('bundle read flow falls back to the preferred user device and then to legacy rows', () => {
  const preferredDeviceBundle = fetchPreferredUserBundle({
    targetUserId: 'user-2',
    getUserDeviceIdentityKeysFn: () => [
      {
        device_id: 3,
        identity_key_public: 'identity-3',
        signing_key_public: 'signing-3',
        registration_id: 33,
        bundle_signature_event: null,
      },
      {
        device_id: 1,
        identity_key_public: 'identity-1',
        signing_key_public: 'signing-1',
        registration_id: 11,
        bundle_signature_event: null,
      },
    ],
    getLatestDeviceSignedPreKeyFn: (userId, deviceId) => (
      deviceId === 1
        ? { key_id: 1, public_key: 'spk-1', signature: 'sig-1' }
        : null
    ),
    getAndClaimDeviceOneTimePreKeyFn: () => null,
    getAndClaimDeviceKyberPreKeyFn: () => null,
  });

  const legacyBundle = fetchPreferredUserBundle({
    targetUserId: 'user-3',
    getUserDeviceIdentityKeysFn: () => [],
    getLatestDeviceSignedPreKeyFn: () => null,
    getIdentityKeyFn: () => ({
      identity_key_public: 'legacy-identity',
      signing_key_public: 'legacy-signing',
      registration_id: 99,
      bundle_signature_event: null,
    }),
    getLatestSignedPreKeyFn: () => ({
      key_id: 9,
      public_key: 'legacy-spk',
      signature: 'legacy-sig',
    }),
    getAndClaimOneTimePreKeyFn: () => null,
    getAndClaimKyberPreKeyFn: () => null,
  });

  assert.equal(preferredDeviceBundle.deviceId, 1);
  assert.equal(preferredDeviceBundle.identityKey, 'identity-1');
  assert.equal(legacyBundle.deviceId, 1);
  assert.equal(legacyBundle.identityKey, 'legacy-identity');
});

test('bundle read flow exposes stable identity records only when both identity and signed prekey exist', () => {
  const record = fetchStableIdentityRecord({
    targetUserId: 'user-4',
    getIdentityKeyFn: () => ({
      identity_key_public: 'identity-4',
      signing_key_public: 'signing-4',
      registration_id: 44,
      bundle_signature_event: '{"kind":24133}',
    }),
    getLatestSignedPreKeyFn: () => ({
      key_id: 4,
      public_key: 'spk-4',
      signature: 'sig-4',
    }),
  });
  const missing = fetchStableIdentityRecord({
    targetUserId: 'user-4',
    getIdentityKeyFn: () => null,
    getLatestSignedPreKeyFn: () => null,
  });

  assert.deepEqual(record, {
    deviceId: 1,
    identityKey: 'identity-4',
    signingKey: 'signing-4',
    registrationId: 44,
    bundleSignatureEvent: { kind: 24133 },
    signedPreKey: {
      keyId: 4,
      publicKey: 'spk-4',
      signature: 'sig-4',
    },
  });
  assert.equal(missing, null);
});
