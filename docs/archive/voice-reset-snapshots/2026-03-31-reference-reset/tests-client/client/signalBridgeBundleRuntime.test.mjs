import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSignalBridgeBundleHandlers,
} = require('../../../client/electron/crypto/signalBridgeBundleRuntime.js');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, callback) {
      handlers.set(channel, callback);
    },
  };
}

function createSerializableRecord({ id, publicKey, signature = null }) {
  return {
    id() {
      return id;
    },
    publicKey() {
      return {
        serialize() {
          return Buffer.from(publicKey, 'utf8');
        },
      };
    },
    signature() {
      return Buffer.from(signature || '', 'utf8');
    },
  };
}

test('signal bridge bundle runtime exports the canonical local prekey bundle', async () => {
  const ipcMain = createIpcMain();
  const store = {
    identity: {
      getLocalIdentityKeyPair() {
        return {
          publicKey: {
            serialize() {
              return Buffer.from('identity-public', 'utf8');
            },
          },
        };
      },
      async getLocalRegistrationId() {
        return 42;
      },
    },
    signedPreKey: {
      getMaxKeyId() {
        return 9;
      },
      async getSignedPreKey() {
        return createSerializableRecord({
          id: 9,
          publicKey: 'signed-prekey-public',
          signature: 'signed-prekey-signature',
        });
      },
    },
    kyberPreKey: {
      getAllIds() {
        return [3, 4];
      },
      async getKyberPreKey(id) {
        return createSerializableRecord({
          id,
          publicKey: `kyber-${id}`,
          signature: `kyber-signature-${id}`,
        });
      },
      getCount() {
        return 7;
      },
    },
    preKey: {
      getAllIds() {
        return [1, 2];
      },
      async getPreKey(id) {
        return createSerializableRecord({
          id,
          publicKey: `otp-${id}`,
        });
      },
      getCount() {
        return 12;
      },
      getMaxKeyId() {
        return 2;
      },
      async savePreKey() {},
    },
  };

  registerSignalBridgeBundleHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => 'local-user',
    getOrCreateLocalDeviceId(uid) {
      assert.equal(uid, 'local-user');
      return 15;
    },
    async generatePreKeys() {
      return [];
    },
    async generateKyberPreKey() {
      throw new Error('generateKyberPreKey should not run during get-bundle');
    },
    otpBatchSize: 100,
    kyberBatchSize: 20,
  });

  assert.deepEqual(await ipcMain.handlers.get('signal:get-bundle')(), {
    deviceId: 15,
    identityKey: Buffer.from('identity-public', 'utf8').toString('base64'),
    registrationId: 42,
    signedPreKey: {
      keyId: 9,
      publicKey: Buffer.from('signed-prekey-public', 'utf8').toString('base64'),
      signature: Buffer.from('signed-prekey-signature', 'utf8').toString('base64'),
    },
    kyberPreKey: {
      keyId: 4,
      publicKey: Buffer.from('kyber-4', 'utf8').toString('base64'),
      signature: Buffer.from('kyber-signature-4', 'utf8').toString('base64'),
    },
    kyberPreKeys: [
      {
        keyId: 3,
        publicKey: Buffer.from('kyber-3', 'utf8').toString('base64'),
        signature: Buffer.from('kyber-signature-3', 'utf8').toString('base64'),
      },
      {
        keyId: 4,
        publicKey: Buffer.from('kyber-4', 'utf8').toString('base64'),
        signature: Buffer.from('kyber-signature-4', 'utf8').toString('base64'),
      },
    ],
    oneTimePreKeys: [
      {
        keyId: 1,
        publicKey: Buffer.from('otp-1', 'utf8').toString('base64'),
      },
      {
        keyId: 2,
        publicKey: Buffer.from('otp-2', 'utf8').toString('base64'),
      },
    ],
  });
  assert.equal(await ipcMain.handlers.get('signal:otp-count')(), 12);
  assert.equal(await ipcMain.handlers.get('signal:kyber-count')(), 7);
});

test('signal bridge bundle runtime caps exported OTPs to the server upload limit', async () => {
  const ipcMain = createIpcMain();
  const store = {
    identity: {
      getLocalIdentityKeyPair() {
        return {
          publicKey: {
            serialize() {
              return Buffer.from('identity-public', 'utf8');
            },
          },
        };
      },
      async getLocalRegistrationId() {
        return 42;
      },
    },
    signedPreKey: {
      getMaxKeyId() {
        return 9;
      },
      async getSignedPreKey() {
        return createSerializableRecord({
          id: 9,
          publicKey: 'signed-prekey-public',
          signature: 'signed-prekey-signature',
        });
      },
    },
    kyberPreKey: {
      getAllIds() {
        return [1];
      },
      async getKyberPreKey(id) {
        return createSerializableRecord({
          id,
          publicKey: `kyber-${id}`,
          signature: `kyber-signature-${id}`,
        });
      },
      getCount() {
        return 1;
      },
    },
    preKey: {
      getAllIds() {
        return Array.from({ length: 250 }, (_value, index) => index + 1);
      },
      async getPreKey(id) {
        return createSerializableRecord({
          id,
          publicKey: `otp-${id}`,
        });
      },
      getCount() {
        return 250;
      },
      getMaxKeyId() {
        return 250;
      },
      async savePreKey() {},
    },
  };

  registerSignalBridgeBundleHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => 'local-user',
    getOrCreateLocalDeviceId() {
      return 15;
    },
    async generatePreKeys() {
      return [];
    },
    async generateKyberPreKey() {
      throw new Error('generateKyberPreKey should not run during get-bundle');
    },
    otpBatchSize: 100,
    kyberBatchSize: 20,
  });

  const bundle = await ipcMain.handlers.get('signal:get-bundle')();
  assert.equal(bundle.oneTimePreKeys.length, 200);
  assert.equal(bundle.oneTimePreKeys[0].keyId, 51);
  assert.equal(bundle.oneTimePreKeys.at(-1).keyId, 250);
});

test('signal bridge bundle runtime replenishes OTP and Kyber prekeys through shared generators', async () => {
  const ipcMain = createIpcMain();
  const savedPreKeys = [];
  const savedKyberPreKeys = [];
  const store = {
    identity: {
      getLocalIdentityKeyPair() {
        return { name: 'identity' };
      },
    },
    preKey: {
      getMaxKeyId() {
        return 20;
      },
      async savePreKey(id, record) {
        savedPreKeys.push({ id, record });
      },
      getCount() {
        return 0;
      },
    },
    kyberPreKey: {
      getMaxKeyId() {
        return 30;
      },
      async saveKyberPreKey(id, record) {
        savedKyberPreKeys.push({ id, record });
      },
      getCount() {
        return 0;
      },
    },
  };
  const generatedOtpCalls = [];
  const generatedKyberCalls = [];

  registerSignalBridgeBundleHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => 'local-user',
    getOrCreateLocalDeviceId() {
      return 1;
    },
    async generatePreKeys(startId, count) {
      generatedOtpCalls.push({ startId, count });
      return [
        createSerializableRecord({ id: 21, publicKey: 'otp-21' }),
        createSerializableRecord({ id: 22, publicKey: 'otp-22' }),
      ];
    },
    async generateKyberPreKey(identity, id) {
      generatedKyberCalls.push({ identity, id });
      return createSerializableRecord({
        id,
        publicKey: `kyber-${id}`,
        signature: `kyber-signature-${id}`,
      });
    },
    otpBatchSize: 2,
    kyberBatchSize: 2,
  });

  assert.deepEqual(await ipcMain.handlers.get('signal:replenish-otps')(), [
    { keyId: 21, publicKey: Buffer.from('otp-21', 'utf8').toString('base64') },
    { keyId: 22, publicKey: Buffer.from('otp-22', 'utf8').toString('base64') },
  ]);
  assert.deepEqual(await ipcMain.handlers.get('signal:replenish-kyber')(), [
    {
      keyId: 31,
      publicKey: Buffer.from('kyber-31', 'utf8').toString('base64'),
      signature: Buffer.from('kyber-signature-31', 'utf8').toString('base64'),
    },
    {
      keyId: 32,
      publicKey: Buffer.from('kyber-32', 'utf8').toString('base64'),
      signature: Buffer.from('kyber-signature-32', 'utf8').toString('base64'),
    },
  ]);

  assert.deepEqual(generatedOtpCalls, [{ startId: 21, count: 2 }]);
  assert.deepEqual(generatedKyberCalls, [
    { identity: { name: 'identity' }, id: 31 },
    { identity: { name: 'identity' }, id: 32 },
  ]);
  assert.equal(savedPreKeys.length, 2);
  assert.equal(savedKyberPreKeys.length, 2);
});

test('signal bridge bundle runtime returns empty counts and rejects bundle operations when the store is unavailable', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeBundleHandlers({
    ipcMain,
    getStore: () => null,
    getUserId: () => 'local-user',
    getOrCreateLocalDeviceId() {
      return 1;
    },
    async generatePreKeys() {
      return [];
    },
    async generateKyberPreKey() {
      return null;
    },
    otpBatchSize: 100,
    kyberBatchSize: 20,
  });

  await assert.rejects(ipcMain.handlers.get('signal:get-bundle')(), /Signal store not initialized/);
  await assert.rejects(ipcMain.handlers.get('signal:replenish-otps')(null, 1), /Signal store not initialized/);
  await assert.rejects(ipcMain.handlers.get('signal:replenish-kyber')(null, 1), /Signal store not initialized/);
  assert.equal(await ipcMain.handlers.get('signal:otp-count')(), 0);
  assert.equal(await ipcMain.handlers.get('signal:kyber-count')(), 0);
});
