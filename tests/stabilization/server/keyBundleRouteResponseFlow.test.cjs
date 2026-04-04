const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCountRouteResult,
  buildDeviceBundleRouteResult,
  buildIdentityResponsesRouteResult,
  buildPreferredUserBundleRouteResult,
  buildStableIdentityRecordRouteResult,
} = require('../../../server/src/domain/keys/bundleRouteResponseFlow');

test('bundle route response flow returns canonical identity lists or not found results', () => {
  assert.deepEqual(buildIdentityResponsesRouteResult({
    targetUserId: 'user-1',
    deviceRows: [
      {
        device_id: 3,
        identity_key_public: 'identity-3',
        signing_key_public: 'signing-3',
        registration_id: 33,
        bundle_signature_event: null,
      },
    ],
    getLatestDeviceSignedPreKeyFn: () => ({
      key_id: 9,
      public_key: 'spk-3',
      signature: 'sig-3',
    }),
    getIdentityKeyFn: () => ({
      device_id: 1,
      identity_key_public: 'legacy-identity',
      signing_key_public: 'legacy-signing',
      registration_id: 1,
      bundle_signature_event: null,
    }),
    getLatestSignedPreKeyFn: () => ({
      key_id: 1,
      public_key: 'legacy-spk',
      signature: 'legacy-sig',
    }),
  }), {
    ok: true,
    body: [
      {
        deviceId: 1,
        identityKey: 'legacy-identity',
        signingKey: 'legacy-signing',
        registrationId: 1,
        bundleSignatureEvent: null,
        signedPreKey: {
          keyId: 1,
          publicKey: 'legacy-spk',
          signature: 'legacy-sig',
        },
      },
      {
        deviceId: 3,
        identityKey: 'identity-3',
        signingKey: 'signing-3',
        registrationId: 33,
        bundleSignatureEvent: null,
        signedPreKey: {
          keyId: 9,
          publicKey: 'spk-3',
          signature: 'sig-3',
        },
      },
    ],
  });

  assert.deepEqual(buildIdentityResponsesRouteResult({
    targetUserId: 'user-2',
    deviceRows: [],
    getLatestDeviceSignedPreKeyFn: () => null,
    getIdentityKeyFn: () => null,
    getLatestSignedPreKeyFn: () => null,
  }), {
    ok: false,
    status: 404,
    error: 'User has no encryption identities',
  });
});

test('bundle route response flow resolves device and preferred user bundles canonically', () => {
  assert.deepEqual(buildDeviceBundleRouteResult({
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
      key_id: 9,
      public_key: 'spk-2',
      signature: 'sig-2',
    }),
    getAndClaimDeviceOneTimePreKeyFn: () => ({
      key_id: 41,
      public_key: 'otp-2',
    }),
    getAndClaimDeviceKyberPreKeyFn: () => ({
      key_id: 51,
      public_key: 'kyber-2',
      signature: 'kyber-sig-2',
    }),
  }), {
    ok: true,
    body: {
      deviceId: 2,
      identityKey: 'identity-2',
      signingKey: 'signing-2',
      registrationId: 22,
      bundleSignatureEvent: null,
      signedPreKey: {
        keyId: 9,
        publicKey: 'spk-2',
        signature: 'sig-2',
      },
      oneTimePreKey: {
        keyId: 41,
        publicKey: 'otp-2',
      },
      kyberPreKey: {
        keyId: 51,
        publicKey: 'kyber-2',
        signature: 'kyber-sig-2',
      },
    },
  });

  assert.deepEqual(buildDeviceBundleRouteResult({
    targetUserId: 'user-1',
    targetDeviceId: 3,
    getDeviceIdentityKeyFn: () => null,
    getLatestDeviceSignedPreKeyFn: () => null,
  }), {
    ok: false,
    status: 404,
    error: 'Device has no encryption bundle',
  });

  assert.deepEqual(buildPreferredUserBundleRouteResult({
    targetUserId: 'user-9',
    getUserDeviceIdentityKeysFn: () => [
      {
        device_id: 4,
        identity_key_public: 'identity-4',
        signing_key_public: 'signing-4',
        registration_id: 44,
        bundle_signature_event: null,
      },
    ],
    getLatestDeviceSignedPreKeyFn: () => ({
      key_id: 12,
      public_key: 'spk-4',
      signature: 'sig-4',
    }),
  }), {
    ok: true,
    body: {
      deviceId: 4,
      identityKey: 'identity-4',
      signingKey: 'signing-4',
      registrationId: 44,
      bundleSignatureEvent: null,
      signedPreKey: {
        keyId: 12,
        publicKey: 'spk-4',
        signature: 'sig-4',
      },
      oneTimePreKey: null,
      kyberPreKey: null,
    },
  });
});

test('bundle route response flow exposes stable identity and count payloads canonically', () => {
  assert.deepEqual(buildStableIdentityRecordRouteResult({
    targetUserId: 'user-1',
    getIdentityKeyFn: () => ({
      device_id: 7,
      identity_key_public: 'identity-7',
      signing_key_public: 'signing-7',
      registration_id: 77,
      bundle_signature_event: null,
    }),
    getLatestSignedPreKeyFn: () => ({
      key_id: 8,
      public_key: 'spk-7',
      signature: 'sig-7',
    }),
  }), {
    ok: true,
    body: {
      deviceId: 1,
      identityKey: 'identity-7',
      signingKey: 'signing-7',
      registrationId: 77,
      bundleSignatureEvent: null,
      signedPreKey: {
        keyId: 8,
        publicKey: 'spk-7',
        signature: 'sig-7',
      },
    },
  });

  assert.deepEqual(buildStableIdentityRecordRouteResult({
    targetUserId: 'user-1',
    getIdentityKeyFn: () => null,
    getLatestSignedPreKeyFn: () => null,
  }), {
    ok: false,
    status: 404,
    error: 'User has no signed prekey',
  });

  assert.deepEqual(buildCountRouteResult({
    userId: 'user-1',
    deviceId: 2,
    countAvailableKeysFn: () => ({ count: 11 }),
    countAvailableDeviceKeysFn: () => ({ count: 4 }),
  }), {
    ok: true,
    body: { count: 4 },
  });
});
