const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createKeysRouteControllerModel,
} = require('../../../server/src/domain/keys/bundleRouteControllerModel');

test('bundle route controller model executes callable claim helpers as well as prepared getters', () => {
  const calls = [];
  const model = createKeysRouteControllerModel({
    getAndClaimDeviceOneTimePreKey: (userId, deviceId) => {
      calls.push(['otp', userId, deviceId]);
      return { key_id: 11, public_key: 'otp-public' };
    },
    getAndClaimDeviceKyberPreKey: (userId, deviceId) => {
      calls.push(['kyber', userId, deviceId]);
      return { key_id: 12, public_key: 'kyber-public', signature: 'kyber-signature' };
    },
  });

  assert.deepEqual(
    model.getAndClaimDeviceOneTimePreKey('user-1', 1),
    { key_id: 11, public_key: 'otp-public' },
  );
  assert.deepEqual(
    model.getAndClaimDeviceKyberPreKey('user-1', 1),
    { key_id: 12, public_key: 'kyber-public', signature: 'kyber-signature' },
  );
  assert.deepEqual(calls, [
    ['otp', 'user-1', 1],
    ['kyber', 'user-1', 1],
  ]);
});
