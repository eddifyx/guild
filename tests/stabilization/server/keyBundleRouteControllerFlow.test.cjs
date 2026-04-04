const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createKeysRouteController,
} = require('../../../server/src/domain/keys/bundleRouteControllerFlow');

function base64OfSize(size) {
  return Buffer.alloc(size, 7).toString('base64');
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return body;
    },
  };
}

function createDbApi(calls = [], overrides = {}) {
  const run = (name) => (...args) => {
    calls.push([name, ...args]);
    return { changes: 1 };
  };

  const createGetter = (name, value) => ({
    get: (...args) => {
      calls.push([name, ...args]);
      return typeof value === 'function' ? value(...args) : value;
    },
  });

  const createLister = (name, value) => ({
    all: (...args) => {
      calls.push([name, ...args]);
      return typeof value === 'function' ? value(...args) : value;
    },
  });

  return {
    db: overrides.db || {
      prepare(sql) {
        calls.push(['prepare', sql]);
        return {
          run: run(sql),
        };
      },
      transaction(callback) {
        calls.push(['transaction']);
        return callback();
      },
    },
    getUserById: createGetter('getUserById', overrides.getUserById ?? { npub: 'npub-1' }),
    getIdentityKey: createGetter('getIdentityKey', overrides.getIdentityKey ?? null),
    getDeviceIdentityKey: createGetter('getDeviceIdentityKey', overrides.getDeviceIdentityKey ?? null),
    getUserDeviceIdentityKeys: createLister('getUserDeviceIdentityKeys', overrides.getUserDeviceIdentityKeys ?? []),
    getLatestSignedPreKey: createGetter('getLatestSignedPreKey', overrides.getLatestSignedPreKey ?? null),
    getLatestDeviceSignedPreKey: createGetter('getLatestDeviceSignedPreKey', overrides.getLatestDeviceSignedPreKey ?? null),
    getAndClaimOneTimePreKey: createGetter('getAndClaimOneTimePreKey', overrides.getAndClaimOneTimePreKey ?? null),
    getAndClaimDeviceOneTimePreKey: createGetter('getAndClaimDeviceOneTimePreKey', overrides.getAndClaimDeviceOneTimePreKey ?? null),
    getAndClaimKyberPreKey: createGetter('getAndClaimKyberPreKey', overrides.getAndClaimKyberPreKey ?? null),
    getAndClaimDeviceKyberPreKey: createGetter('getAndClaimDeviceKyberPreKey', overrides.getAndClaimDeviceKyberPreKey ?? null),
    countAvailableOTPs: createGetter('countAvailableOTPs', overrides.countAvailableOTPs ?? { count: 0 }),
    countAvailableDeviceOTPs: createGetter('countAvailableDeviceOTPs', overrides.countAvailableDeviceOTPs ?? { count: 0 }),
    countAvailableKyberPreKeys: createGetter('countAvailableKyberPreKeys', overrides.countAvailableKyberPreKeys ?? { count: 0 }),
    countAvailableDeviceKyberPreKeys: createGetter('countAvailableDeviceKyberPreKeys', overrides.countAvailableDeviceKyberPreKeys ?? { count: 0 }),
    listVisibleGuildmateIds: createLister('listVisibleGuildmateIds', overrides.listVisibleGuildmateIds ?? []),
    listVisibleContactUserIds: createLister('listVisibleContactUserIds', overrides.listVisibleContactUserIds ?? []),
    upsertIdentityKey: { run: run('upsertIdentityKey') },
    upsertDeviceIdentityKey: { run: run('upsertDeviceIdentityKey') },
    upsertSignedPreKey: { run: run('upsertSignedPreKey') },
    upsertDeviceSignedPreKey: { run: run('upsertDeviceSignedPreKey') },
    insertOneTimePreKey: { run: run('insertOneTimePreKey') },
    insertDeviceOneTimePreKey: { run: run('insertDeviceOneTimePreKey') },
    insertKyberPreKey: { run: run('insertKyberPreKey') },
    insertDeviceKyberPreKey: { run: run('insertDeviceKyberPreKey') },
    resetUserKeys: { run: run('resetUserKeys') },
  };
}

test('bundle route controller uploads validated bundles through the canonical database adapters', async () => {
  const calls = [];
  const dbApi = createDbApi(calls, {
    getUserById: { npub: 'npub-1' },
    getIdentityKey: null,
  });
  const controller = createKeysRouteController({
    dbApi,
    verifyBundleAttestationEventFn: () => true,
    nowFn: () => 1_000,
  });
  const res = createRes();

  await controller.uploadBundle({
    userId: 'user-1',
    body: {
      deviceId: 2,
      identityKey: base64OfSize(32),
      registrationId: 17,
      signedPreKey: {
        keyId: 8,
        publicKey: base64OfSize(32),
        signature: base64OfSize(64),
      },
      oneTimePreKeys: [
        { keyId: 11, publicKey: base64OfSize(32) },
      ],
      kyberPreKey: {
        keyId: 12,
        publicKey: base64OfSize(33),
        signature: base64OfSize(64),
      },
      kyberPreKeys: [
        { keyId: 13, publicKey: base64OfSize(33), signature: base64OfSize(64) },
      ],
      bundleSignatureEvent: {
        signature: 'bundle-signature',
      },
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { success: true });
  assert.ok(calls.some(([name]) => name === 'prepare'));
  assert.ok(calls.some(([name]) => name === 'transaction'));
  assert.ok(calls.some(([name]) => name === 'upsertDeviceIdentityKey'));
  assert.ok(calls.some(([name]) => name === 'upsertDeviceSignedPreKey'));
  assert.ok(calls.some(([name]) => name === 'insertDeviceOneTimePreKey'));
  assert.ok(calls.some(([name]) => name === 'insertDeviceKyberPreKey'));
});

test('bundle route controller enforces self-fetch guards and visibility checks before reading bundles', () => {
  const controller = createKeysRouteController({
    dbApi: createDbApi([], {
      listVisibleGuildmateIds: [],
      listVisibleContactUserIds: [],
      getUserDeviceIdentityKeys: [],
    }),
  });

  const selfIdentityResponse = createRes();
  controller.getStableIdentityRecord({
    userId: 'user-1',
    params: { userId: 'user-1' },
  }, selfIdentityResponse);

  const forbiddenBundleResponse = createRes();
  controller.getPreferredUserBundle({
    userId: 'user-1',
    params: { userId: 'user-2' },
  }, forbiddenBundleResponse);

  assert.equal(selfIdentityResponse.statusCode, 400);
  assert.deepEqual(selfIdentityResponse.payload, { error: 'Cannot fetch own identity record' });
  assert.equal(forbiddenBundleResponse.statusCode, 403);
  assert.deepEqual(forbiddenBundleResponse.payload, { error: 'You can only fetch encryption bundles for visible users' });
});

test('bundle route controller delegates counts, replenishment, and reset through the domain flows', () => {
  const calls = [];
  const controller = createKeysRouteController({
    dbApi: createDbApi(calls, {
      countAvailableOTPs: { count: 9 },
      countAvailableDeviceOTPs: { count: 4 },
      countAvailableKyberPreKeys: { count: 7 },
      countAvailableDeviceKyberPreKeys: { count: 3 },
      listVisibleGuildmateIds: [{ user_id: 'user-2' }],
      listVisibleContactUserIds: [],
    }),
  });

  const countResponse = createRes();
  controller.countOTPs({
    userId: 'user-1',
    query: { deviceId: '2' },
  }, countResponse);

  const kyberCountResponse = createRes();
  controller.countKyberPreKeys({
    userId: 'user-1',
    query: {},
  }, kyberCountResponse);

  const replenishResponse = createRes();
  controller.replenishOneTimePreKeys({
    userId: 'user-1',
    body: {
      deviceId: 2,
      oneTimePreKeys: [
        { keyId: 31, publicKey: base64OfSize(32) },
      ],
    },
  }, replenishResponse);

  const resetResponse = createRes();
  controller.resetKeys({
    userId: 'user-1',
  }, resetResponse);

  assert.deepEqual(countResponse.payload, { count: 4 });
  assert.deepEqual(kyberCountResponse.payload, { count: 7 });
  assert.deepEqual(replenishResponse.payload, { success: true, count: 4 });
  assert.deepEqual(resetResponse.payload, { success: true });
  assert.ok(calls.some(([name]) => name === 'insertDeviceOneTimePreKey'));
  assert.ok(calls.some(([name]) => name === 'resetUserKeys'));
});
