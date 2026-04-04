import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSignalBridgeIdentityHandlers,
} = require('../../../client/electron/crypto/signalBridgeIdentityRuntime.js');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, callback) {
      handlers.set(channel, callback);
    },
  };
}

function createSignalModuleStub() {
  return {
    ProtocolAddress: {
      new(name, deviceId) {
        return { name, deviceId };
      },
    },
    PublicKey: {
      deserialize(buffer) {
        return { type: 'public-key', value: buffer.toString('utf8') };
      },
    },
    Fingerprint: {
      new(iterations, version, localUser, localKey, remoteUser, remoteKey) {
        return {
          displayableFingerprint() {
            return {
              toString() {
                return [
                  iterations,
                  version,
                  localUser.toString('utf8'),
                  localKey.serialized,
                  remoteUser.toString('utf8'),
                  remoteKey.value,
                ].join(':');
              },
            };
          },
        };
      },
    },
  };
}

test('signal bridge identity runtime resolves trust, approval, verification, and fingerprint through canonical handlers', async () => {
  const ipcMain = createIpcMain();
  const signalModule = createSignalModuleStub();
  const calls = {
    trust: [],
    approve: [],
    verify: [],
  };
  const store = {
    identity: {
      getTrustState(address, identityKey) {
        calls.trust.push({ address, identityKey });
        return { trusted: Boolean(identityKey), address };
      },
      approveIdentity(address, identityKey, options) {
        calls.approve.push({ address, identityKey, options });
        return { approved: true, options };
      },
      markIdentityVerified(address, identityKey) {
        calls.verify.push({ address, identityKey });
        return { verified: true };
      },
      getLocalIdentityKeyPair() {
        return {
          publicKey: { serialized: 'local-public' },
        };
      },
    },
  };

  registerSignalBridgeIdentityHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => 'local-user',
    getSignalModule: async () => signalModule,
    normalizeDeviceId(value) {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  });

  assert.deepEqual(
    await ipcMain.handlers.get('signal:get-identity-state')(null, 'remote-user', '7', Buffer.from('remote-key').toString('base64')),
    {
      trusted: true,
      address: { name: 'remote-user', deviceId: 7 },
    }
  );
  assert.deepEqual(
    await ipcMain.handlers.get('signal:approve-identity')(
      null,
      'remote-user',
      '5',
      Buffer.from('approve-key').toString('base64'),
      { source: 'manual' }
    ),
    { approved: true, options: { source: 'manual' } }
  );
  assert.deepEqual(
    await ipcMain.handlers.get('signal:mark-identity-verified')(
      null,
      'remote-user',
      3,
      Buffer.from('verify-key').toString('base64')
    ),
    { verified: true }
  );
  assert.equal(
    await ipcMain.handlers.get('signal:get-fingerprint')(
      null,
      'remote-user',
      Buffer.from('fingerprint-key').toString('base64')
    ),
    '5200:2:local-user:local-public:remote-user:fingerprint-key'
  );

  assert.deepEqual(calls.trust, [
    {
      address: { name: 'remote-user', deviceId: 7 },
      identityKey: { type: 'public-key', value: 'remote-key' },
    },
  ]);
  assert.deepEqual(calls.approve, [
    {
      address: { name: 'remote-user', deviceId: 5 },
      identityKey: { type: 'public-key', value: 'approve-key' },
      options: { source: 'manual' },
    },
  ]);
  assert.deepEqual(calls.verify, [
    {
      address: { name: 'remote-user', deviceId: 3 },
      identityKey: { type: 'public-key', value: 'verify-key' },
    },
  ]);
});

test('signal bridge identity runtime manages session existence and deletion through canonical addresses', async () => {
  const ipcMain = createIpcMain();
  const signalModule = createSignalModuleStub();
  const removedAddresses = [];
  const store = {
    session: {
      async getSession(address) {
        if (address.deviceId === 1) {
          return {
            hasCurrentState() {
              return true;
            },
          };
        }
        return null;
      },
    },
    async removeSession(address) {
      removedAddresses.push(address);
    },
  };

  registerSignalBridgeIdentityHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => 'local-user',
    getSignalModule: async () => signalModule,
    normalizeDeviceId(value) {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  });

  assert.equal(await ipcMain.handlers.get('signal:has-session')(null, 'remote-user', 1), true);
  assert.equal(await ipcMain.handlers.get('signal:has-session')(null, 'remote-user', 2), false);
  await ipcMain.handlers.get('signal:delete-session')(null, 'remote-user', '9');
  assert.deepEqual(removedAddresses, [{ name: 'remote-user', deviceId: 9 }]);
});

test('signal bridge identity runtime treats missing store as unavailable for trust and session handlers', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeIdentityHandlers({
    ipcMain,
    getStore: () => null,
    getUserId: () => 'local-user',
    getSignalModule: async () => createSignalModuleStub(),
    normalizeDeviceId(value) {
      return Number(value);
    },
  });

  await assert.rejects(
    ipcMain.handlers.get('signal:get-identity-state')(null, 'remote-user'),
    /Signal store not initialized/
  );
  await assert.rejects(
    ipcMain.handlers.get('signal:get-fingerprint')(null, 'remote-user', Buffer.from('key').toString('base64')),
    /Signal store not initialized/
  );
  assert.equal(await ipcMain.handlers.get('signal:has-session')(null, 'remote-user', 1), false);
  await assert.doesNotReject(() => ipcMain.handlers.get('signal:delete-session')(null, 'remote-user', 1));
});
