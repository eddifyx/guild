const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../../../server/src/domain/keys/bundleFlow');

test('bundle flow parses bundle signature events safely', () => {
  assert.deepEqual(parseBundleSignatureEvent('{"kind":24133}'), { kind: 24133 });
  assert.equal(parseBundleSignatureEvent('not-json'), null);
  assert.equal(parseBundleSignatureEvent(null), null);
});

test('bundle flow normalizes requested device ids from params, body, and query', () => {
  assert.equal(normalizeDeviceId('2'), 2);
  assert.equal(normalizeDeviceId('0'), null);
  assert.equal(shouldMirrorLegacyRows(1), true);
  assert.equal(shouldMirrorLegacyRows(2), false);
  assert.equal(getRequestedDeviceId({ params: { deviceId: '4' } }), 4);
  assert.equal(getRequestedDeviceId({ body: { deviceId: '5' } }), 5);
  assert.equal(getRequestedDeviceId({ query: { deviceId: '6' } }), 6);
});

test('bundle flow builds canonical device and legacy bundle responses', () => {
  const identity = {
    device_id: 7,
    identity_key_public: 'identity-key',
    signing_key_public: 'signing-key',
    registration_id: 42,
    bundle_signature_event: '{"kind":24133,"id":"attestation"}',
  };
  const signedPreKey = {
    key_id: 11,
    public_key: 'spk-public',
    signature: 'spk-signature',
  };
  const oneTimePreKey = {
    key_id: 12,
    public_key: 'otp-public',
  };
  const kyberPreKey = {
    key_id: 13,
    public_key: 'kyber-public',
    signature: 'kyber-signature',
  };

  const deviceBundle = buildDeviceBundleResponse(
    identity,
    signedPreKey,
    oneTimePreKey,
    kyberPreKey,
  );
  const legacyBundle = buildLegacyDeviceResponse(identity, signedPreKey);
  const deviceIdentity = buildDeviceIdentityResponse(identity, signedPreKey);

  assert.equal(deviceBundle.deviceId, 7);
  assert.deepEqual(deviceBundle.bundleSignatureEvent, { kind: 24133, id: 'attestation' });
  assert.deepEqual(deviceBundle.oneTimePreKey, { keyId: 12, publicKey: 'otp-public' });
  assert.deepEqual(deviceBundle.kyberPreKey, {
    keyId: 13,
    publicKey: 'kyber-public',
    signature: 'kyber-signature',
  });
  assert.equal(legacyBundle.deviceId, 1);
  assert.deepEqual(deviceIdentity, {
    deviceId: 7,
    identityKey: 'identity-key',
    signingKey: 'signing-key',
    registrationId: 42,
    bundleSignatureEvent: { kind: 24133, id: 'attestation' },
    signedPreKey: {
      keyId: 11,
      publicKey: 'spk-public',
      signature: 'spk-signature',
    },
  });
});

test('bundle flow selects preferred bundle devices and enforces rate limits canonically', () => {
  assert.deepEqual(
    selectPreferredBundleDevice([
      { device_id: 3 },
      { device_id: 1 },
      { device_id: 2 },
    ]),
    { device_id: 1 },
  );
  assert.deepEqual(selectPreferredBundleDevice([{ device_id: 9 }]), { device_id: 9 });
  assert.equal(selectPreferredBundleDevice([]), null);

  const rateLimitMap = new Map();
  const now = 1000;
  assert.deepEqual(
    consumeRateLimitBucket(rateLimitMap, 'bucket-1', now, { windowMs: 5000, maxCount: 2 }),
    { allowed: true },
  );
  assert.deepEqual(
    consumeRateLimitBucket(rateLimitMap, 'bucket-1', now + 1, { windowMs: 5000, maxCount: 2 }),
    { allowed: true },
  );
  assert.deepEqual(
    consumeRateLimitBucket(rateLimitMap, 'bucket-1', now + 2, { windowMs: 5000, maxCount: 2 }),
    { allowed: false },
  );
});

test('bundle flow builds count responses and replenish-limit errors consistently', () => {
  assert.deepEqual(buildCountResponse({ count: 9 }), { count: 9 });
  assert.deepEqual(buildCountResponse(null), { count: 0 });
  assert.equal(getReplenishLimitError({
    currentCount: 0,
    incomingCount: 250,
    replenishMax: 200,
    totalMax: 500,
    label: 'OTPs',
  }), 'Too many OTPs (max 200)');
  assert.equal(getReplenishLimitError({
    currentCount: 450,
    incomingCount: 100,
    replenishMax: 200,
    totalMax: 500,
    label: 'OTPs',
  }), 'OTPs limit exceeded (450 existing + 100 new > 500 max)');
  assert.equal(getReplenishLimitError({
    currentCount: 10,
    incomingCount: 5,
    replenishMax: 200,
    totalMax: 500,
    label: 'OTPs',
  }), null);
});
