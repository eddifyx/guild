const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBundleKeyCount,
  replenishKyberPreKeys,
  replenishOneTimePreKeys,
} = require('../../../server/src/domain/keys/bundleMaintenanceFlow');

test('bundle maintenance flow resolves shared counts across user and device scopes', () => {
  assert.deepEqual(getBundleKeyCount({
    userId: 'user-1',
    countAvailableKeysFn: () => ({ count: 7 }),
  }), { count: 7 });

  assert.deepEqual(getBundleKeyCount({
    userId: 'user-1',
    deviceId: 3,
    countAvailableKeysFn: () => ({ count: 7 }),
    countAvailableDeviceKeysFn: () => ({ count: 2 }),
  }), { count: 2 });
});

test('bundle maintenance flow replenishes one-time prekeys with canonical limits and mirroring', () => {
  const legacyRows = [];
  const deviceRows = [];

  const result = replenishOneTimePreKeys({
    userId: 'user-1',
    deviceId: 2,
    oneTimePreKeys: [
      { keyId: 1, publicKey: 'valid' },
      { keyId: 2, publicKey: 'skip-me' },
    ],
    countAvailableKeysFn: () => ({ count: 1 }),
    countAvailableDeviceKeysFn: () => ({ count: 3 }),
    insertOneTimePreKeyFn: (...args) => legacyRows.push(args),
    insertDeviceOneTimePreKeyFn: (...args) => deviceRows.push(args),
    isValidBase64KeyRangeFn: (key) => key === 'valid',
  });

  assert.deepEqual(result, {
    ok: true,
    body: {
      success: true,
      count: 3,
    },
  });
  assert.deepEqual(legacyRows, []);
  assert.deepEqual(deviceRows, [['user-1', 2, 1, 'valid']]);

  assert.deepEqual(replenishOneTimePreKeys({
    userId: 'user-1',
    oneTimePreKeys: new Array(201).fill({ keyId: 1, publicKey: 'valid' }),
    countAvailableKeysFn: () => ({ count: 0 }),
    isValidBase64KeyRangeFn: () => true,
  }), {
    ok: false,
    status: 400,
    error: 'Too many OTPs (max 200)',
  });
});

test('bundle maintenance flow replenishes Kyber prekeys with canonical limits and mirroring', () => {
  const legacyRows = [];
  const deviceRows = [];

  const result = replenishKyberPreKeys({
    userId: 'user-2',
    deviceId: 1,
    kyberPreKeys: [
      { keyId: 9, publicKey: 'kyber-public', signature: 'sig' },
      { keyId: 10, publicKey: 'ignored', signature: null },
    ],
    countAvailableKeysFn: () => ({ count: 4 }),
    countAvailableDeviceKeysFn: () => ({ count: 6 }),
    insertKyberPreKeyFn: (...args) => legacyRows.push(args),
    insertDeviceKyberPreKeyFn: (...args) => deviceRows.push(args),
  });

  assert.deepEqual(result, {
    ok: true,
    body: {
      success: true,
      count: 6,
    },
  });
  assert.deepEqual(legacyRows, [['user-2', 9, 'kyber-public', 'sig']]);
  assert.deepEqual(deviceRows, [['user-2', 1, 9, 'kyber-public', 'sig']]);

  assert.deepEqual(replenishKyberPreKeys({
    userId: 'user-2',
    kyberPreKeys: new Array(51).fill({ keyId: 1, publicKey: 'a', signature: 'b' }),
    countAvailableKeysFn: () => ({ count: 0 }),
  }), {
    ok: false,
    status: 400,
    error: 'Too many Kyber prekeys (max 50)',
  });
});
