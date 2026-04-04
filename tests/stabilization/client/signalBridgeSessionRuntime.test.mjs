import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSignalBridgeSessionHandlers,
} = require('../../../client/electron/crypto/signalBridgeSessionRuntime.js');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, callback) {
      handlers.set(channel, callback);
    },
  };
}

function createSignalModuleStub(overrides = {}) {
  return {
    ProtocolAddress: {
      new(name, deviceId) {
        return { name, deviceId };
      },
    },
    PublicKey: {
      deserialize(buffer) {
        return { kind: 'public-key', value: buffer.toString('utf8') };
      },
    },
    KEMPublicKey: {
      deserialize(buffer) {
        return { kind: 'kem-public-key', value: buffer.toString('utf8') };
      },
    },
    PreKeyBundle: {
      new(...args) {
        if (overrides.createPreKeyBundle) {
          return overrides.createPreKeyBundle(...args);
        }
        return { args };
      },
    },
    async processPreKeyBundle(preKeyBundle, address, sessionStore, identityStore) {
      if (overrides.processPreKeyBundle) {
        return overrides.processPreKeyBundle(preKeyBundle, address, sessionStore, identityStore);
      }
      return undefined;
    },
    async signalEncrypt(plaintext, address, sessionStore, identityStore) {
      if (overrides.signalEncrypt) {
        return overrides.signalEncrypt(plaintext, address, sessionStore, identityStore);
      }
      return {
        type() {
          return 3;
        },
        serialize() {
          return Buffer.from(`enc:${address.name}:${plaintext.toString('utf8')}`, 'utf8');
        },
      };
    },
    CiphertextMessageType: {
      PreKey: 7,
    },
    PreKeySignalMessage: {
      deserialize(buffer) {
        return { preKeyPayload: buffer.toString('utf8') };
      },
    },
    SignalMessage: {
      deserialize(buffer) {
        return { signalPayload: buffer.toString('utf8') };
      },
    },
    async signalDecryptPreKey(message, address, sessionStore, identityStore, preKeyStore, signedPreKeyStore, kyberPreKeyStore) {
      if (overrides.signalDecryptPreKey) {
        return overrides.signalDecryptPreKey(
          message,
          address,
          sessionStore,
          identityStore,
          preKeyStore,
          signedPreKeyStore,
          kyberPreKeyStore
        );
      }
      return Buffer.from(`pre:${address.name}:${message.preKeyPayload}`, 'utf8');
    },
    async signalDecrypt(message, address, sessionStore, identityStore) {
      if (overrides.signalDecrypt) {
        return overrides.signalDecrypt(message, address, sessionStore, identityStore);
      }
      return Buffer.from(`sig:${address.name}:${message.signalPayload}`, 'utf8');
    },
  };
}

test('signal bridge session runtime processes recipient bundles through the canonical PQXDH contract', async () => {
  const ipcMain = createIpcMain();
  const calls = [];
  const store = {
    session: { label: 'session-store' },
    identity: { label: 'identity-store' },
  };

  registerSignalBridgeSessionHandlers({
    ipcMain,
    getStore: () => store,
    getSignalModule: async () => createSignalModuleStub({
      processPreKeyBundle(preKeyBundle, address, sessionStore, identityStore) {
        calls.push({ preKeyBundle, address, sessionStore, identityStore });
      },
    }),
    normalizeDeviceId(value) {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  });

  await ipcMain.handlers.get('signal:process-bundle')(null, 'remote-user', '8', {
    registrationId: 99,
    identityKey: Buffer.from('identity-key', 'utf8').toString('base64'),
    signedPreKey: {
      keyId: 5,
      publicKey: Buffer.from('signed-public', 'utf8').toString('base64'),
      signature: Buffer.from('signed-signature', 'utf8').toString('base64'),
    },
    oneTimePreKey: {
      keyId: 6,
      publicKey: Buffer.from('otp-public', 'utf8').toString('base64'),
    },
    kyberPreKey: {
      keyId: 7,
      publicKey: Buffer.from('kyber-public', 'utf8').toString('base64'),
      signature: Buffer.from('kyber-signature', 'utf8').toString('base64'),
    },
  });

  assert.deepEqual(calls, [
    {
      preKeyBundle: {
        args: [
          99,
          8,
          6,
          { kind: 'public-key', value: 'otp-public' },
          5,
          { kind: 'public-key', value: 'signed-public' },
          Buffer.from('signed-signature', 'utf8'),
          { kind: 'public-key', value: 'identity-key' },
          7,
          { kind: 'kem-public-key', value: 'kyber-public' },
          Buffer.from('kyber-signature', 'utf8'),
        ],
      },
      address: { name: 'remote-user', deviceId: 8 },
      sessionStore: store.session,
      identityStore: store.identity,
    },
  ]);
});

test('signal bridge session runtime rejects bundle processing when Kyber prekeys are missing', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeSessionHandlers({
    ipcMain,
    getStore: () => ({ session: {}, identity: {} }),
    getSignalModule: async () => createSignalModuleStub(),
    normalizeDeviceId(value) {
      return Number(value);
    },
  });

  await assert.rejects(
    () =>
      ipcMain.handlers.get('signal:process-bundle')(null, 'remote-user', 1, {
        registrationId: 1,
        identityKey: Buffer.from('identity-key', 'utf8').toString('base64'),
        signedPreKey: {
          keyId: 5,
          publicKey: Buffer.from('signed-public', 'utf8').toString('base64'),
          signature: Buffer.from('signed-signature', 'utf8').toString('base64'),
        },
      }),
    /Recipient has no Kyber prekeys/
  );
});

test('signal bridge session runtime encrypts and decrypts direct messages through canonical handlers', async () => {
  const ipcMain = createIpcMain();
  const store = {
    session: { label: 'session-store' },
    identity: { label: 'identity-store' },
    preKey: { label: 'prekey-store' },
    signedPreKey: { label: 'signed-prekey-store' },
    kyberPreKey: { label: 'kyber-prekey-store' },
  };

  registerSignalBridgeSessionHandlers({
    ipcMain,
    getStore: () => store,
    getSignalModule: async () => createSignalModuleStub(),
    normalizeDeviceId(value) {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  });

  assert.deepEqual(
    await ipcMain.handlers.get('signal:encrypt')(null, 'remote-user', '4', 'hello'),
    {
      type: 3,
      payload: Buffer.from('enc:remote-user:hello', 'utf8').toString('base64'),
    }
  );
  assert.equal(
    await ipcMain.handlers.get('signal:decrypt')(
      null,
      'remote-user',
      '4',
      7,
      Buffer.from('prekey-payload', 'utf8').toString('base64')
    ),
    'pre:remote-user:prekey-payload'
  );
  assert.equal(
    await ipcMain.handlers.get('signal:decrypt')(
      null,
      'remote-user',
      '4',
      99,
      Buffer.from('signal-payload', 'utf8').toString('base64')
    ),
    'sig:remote-user:signal-payload'
  );
});

test('signal bridge session runtime rejects operations when the store is unavailable', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeSessionHandlers({
    ipcMain,
    getStore: () => null,
    getSignalModule: async () => createSignalModuleStub(),
    normalizeDeviceId(value) {
      return Number(value);
    },
  });

  await assert.rejects(
    () => ipcMain.handlers.get('signal:process-bundle')(null, 'remote-user', 1, {}),
    /Signal store not initialized/
  );
  await assert.rejects(
    () => ipcMain.handlers.get('signal:encrypt')(null, 'remote-user', 1, 'hello'),
    /Signal store not initialized/
  );
  await assert.rejects(
    () => ipcMain.handlers.get('signal:decrypt')(null, 'remote-user', 1, 7, Buffer.from('x').toString('base64')),
    /Signal store not initialized/
  );
});
