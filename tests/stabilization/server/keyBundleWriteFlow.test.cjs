const test = require('node:test');
const assert = require('node:assert/strict');

const {
  persistValidatedBundleUpload,
  resetBundleKeys,
  runBundleTransaction,
} = require('../../../server/src/domain/keys/bundleWriteFlow');

function base64OfSize(size) {
  return Buffer.alloc(size, 3).toString('base64');
}

test('bundle write flow persists validated uploads through the canonical transaction shape', () => {
  const calls = [];
  const result = persistValidatedBundleUpload({
    userId: 'user-1',
    deviceId: 2,
    identityKey: 'identity-2',
    storedSigningKey: 'signing-2',
    registrationId: 11,
    signedPreKey: {
      keyId: 4,
      publicKey: base64OfSize(32),
      signature: base64OfSize(64),
    },
    oneTimePreKeys: [
      { keyId: 8, publicKey: base64OfSize(32) },
      { keyId: 9, publicKey: 'skip' },
    ],
    kyberPreKey: {
      keyId: 10,
      publicKey: base64OfSize(33),
      signature: base64OfSize(64),
    },
    kyberPreKeys: [
      { keyId: 11, publicKey: base64OfSize(33), signature: base64OfSize(64) },
    ],
    mirrorLegacyRows: true,
    replaceServerPreKeys: true,
    isV2: false,
    dbTransactionFn: (callback) => callback(),
    deleteUserOneTimePreKeysFn: (userId) => calls.push(['delete-user-otp', userId]),
    deleteUserKyberPreKeysFn: (userId) => calls.push(['delete-user-kyber', userId]),
    deleteUserSignedPreKeysFn: (userId) => calls.push(['delete-user-spk', userId]),
    deleteDeviceOneTimePreKeysFn: (userId, deviceId) => calls.push(['delete-device-otp', userId, deviceId]),
    deleteDeviceKyberPreKeysFn: (userId, deviceId) => calls.push(['delete-device-kyber', userId, deviceId]),
    deleteDeviceSignedPreKeysFn: (userId, deviceId) => calls.push(['delete-device-spk', userId, deviceId]),
    upsertIdentityKeyFn: (...args) => calls.push(['upsert-identity', ...args]),
    upsertDeviceIdentityKeyFn: (...args) => calls.push(['upsert-device-identity', ...args]),
    upsertSignedPreKeyFn: (...args) => calls.push(['upsert-spk', ...args]),
    upsertDeviceSignedPreKeyFn: (...args) => calls.push(['upsert-device-spk', ...args]),
    insertOneTimePreKeyFn: (...args) => calls.push(['insert-otp', ...args]),
    insertDeviceOneTimePreKeyFn: (...args) => calls.push(['insert-device-otp', ...args]),
    insertKyberPreKeyFn: (...args) => calls.push(['insert-kyber', ...args]),
    insertDeviceKyberPreKeyFn: (...args) => calls.push(['insert-device-kyber', ...args]),
    isValidBase64KeyRangeFn: (value, min, max) => {
      const size = Buffer.from(value, 'base64').length;
      return size >= min && size <= max;
    },
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(calls, [
    ['delete-user-otp', 'user-1'],
    ['delete-user-kyber', 'user-1'],
    ['delete-user-spk', 'user-1'],
    ['delete-device-otp', 'user-1', 2],
    ['delete-device-kyber', 'user-1', 2],
    ['delete-device-spk', 'user-1', 2],
    ['upsert-identity', 'user-1', 'identity-2', 'signing-2', 11, null],
    ['upsert-device-identity', 'user-1', 2, 'identity-2', 'signing-2', 11, null],
    ['upsert-spk', 'user-1', 4, base64OfSize(32), base64OfSize(64)],
    ['upsert-device-spk', 'user-1', 2, 4, base64OfSize(32), base64OfSize(64)],
    ['insert-otp', 'user-1', 8, base64OfSize(32)],
    ['insert-device-otp', 'user-1', 2, 8, base64OfSize(32)],
    ['insert-kyber', 'user-1', 10, base64OfSize(33), base64OfSize(64)],
    ['insert-device-kyber', 'user-1', 2, 10, base64OfSize(33), base64OfSize(64)],
    ['insert-kyber', 'user-1', 11, base64OfSize(33), base64OfSize(64)],
    ['insert-device-kyber', 'user-1', 2, 11, base64OfSize(33), base64OfSize(64)],
  ]);
});

test('bundle write flow resets keys through the canonical reset helper', () => {
  const calls = [];
  assert.deepEqual(resetBundleKeys({
    userId: 'user-2',
    resetUserKeysFn: (userId) => calls.push(userId),
  }), { success: true });
  assert.deepEqual(calls, ['user-2']);
});

test('bundle write flow executes better-sqlite style transaction wrappers', () => {
  const calls = [];
  const result = runBundleTransaction(
    (callback) => () => callback(),
    () => {
      calls.push('executed');
      return { ok: true };
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ['executed']);
});
