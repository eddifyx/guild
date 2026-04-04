const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildIdentityResponses,
  canAccessUserKeys,
  consumeBundleRouteRateLimit,
} = require('../../../server/src/domain/keys/bundleRouteFlow');

test('bundle route flow derives visible-user access through the canonical visibility helpers', () => {
  assert.equal(canAccessUserKeys({
    requesterUserId: 'user-1',
    targetUserId: 'user-2',
    listVisibleGuildmateIdsFn: () => [{ user_id: 'user-2' }],
    listVisibleContactUserIdsFn: () => [],
  }), true);

  assert.equal(canAccessUserKeys({
    requesterUserId: 'user-1',
    targetUserId: 'user-9',
    listVisibleGuildmateIdsFn: () => [],
    listVisibleContactUserIdsFn: () => [],
  }), false);
});

test('bundle route flow enforces target and requester bundle rate limits canonically', () => {
  const bundleRateLimit = new Map();
  const targetRateLimit = new Map();

  assert.deepEqual(consumeBundleRouteRateLimit({
    bundleRateLimit,
    targetRateLimit,
    requesterUserId: 'user-a',
    targetUserId: 'user-b',
    now: 1000,
    bundleMaxCount: 1,
    targetMaxCount: 1,
  }), { ok: true });

  assert.deepEqual(consumeBundleRouteRateLimit({
    bundleRateLimit,
    targetRateLimit,
    requesterUserId: 'user-c',
    targetUserId: 'user-b',
    now: 1001,
    bundleMaxCount: 1,
    targetMaxCount: 1,
  }), {
    ok: false,
    status: 429,
    error: 'Too many bundle requests for this user. Try again later.',
  });

  const requesterLimited = consumeBundleRouteRateLimit({
    bundleRateLimit: new Map(),
    targetRateLimit: new Map(),
    requesterUserId: 'user-a',
    targetUserId: 'user-z',
    targetDeviceId: 4,
    now: 2000,
    bundleMaxCount: 1,
    targetMaxCount: 2,
  });
  assert.deepEqual(requesterLimited, { ok: true });

  assert.deepEqual(consumeBundleRouteRateLimit({
    bundleRateLimit: requesterLimited.ok ? new Map([['user-a:user-z:4', { count: 1, resetTime: 5000 }]]) : new Map(),
    targetRateLimit: new Map(),
    requesterUserId: 'user-a',
    targetUserId: 'user-z',
    targetDeviceId: 4,
    now: 2001,
    bundleMaxCount: 1,
    targetMaxCount: 2,
  }), {
    ok: false,
    status: 429,
    error: 'Too many bundle requests. Try again later.',
  });
});

test('bundle route flow builds device identity responses and backfills legacy device 1 when needed', () => {
  const responses = buildIdentityResponses({
    targetUserId: 'user-2',
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
      device_id: 99,
      identity_key_public: 'identity-legacy',
      signing_key_public: 'signing-legacy',
      registration_id: 1,
      bundle_signature_event: null,
    }),
    getLatestSignedPreKeyFn: () => ({
      key_id: 1,
      public_key: 'spk-legacy',
      signature: 'sig-legacy',
    }),
  });

  assert.deepEqual(responses.map((entry) => entry.deviceId), [1, 3]);
  assert.equal(responses[0].identityKey, 'identity-legacy');
  assert.equal(responses[1].identityKey, 'identity-3');
});
