import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSignalBridgeLifecycleHandlers,
} = require('../../../client/electron/crypto/signalBridgeLifecycleRuntime.js');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, callback) {
      handlers.set(channel, callback);
    },
  };
}

function createLocalIdentity(publicKeyText) {
  return {
    publicKey: {
      serialize() {
        return Buffer.from(publicKeyText, 'utf8');
      },
    },
  };
}

test('signal bridge lifecycle runtime recovers from unreadable local state during initialize', async () => {
  const ipcMain = createIpcMain();
  const bridgeState = {
    userId: null,
    localDeviceId: null,
    localDeviceOwner: null,
  };
  let store = null;
  let userId = null;
  let createStoreCalls = 0;
  let bootstrapCalls = 0;
  let resetUid = null;
  let firstStoreClosed = false;
  const warnings = [];
  const firstStore = {
    close() {
      firstStoreClosed = true;
    },
    identity: {
      hasLocalIdentity() {
        throw new Error('bad decrypt');
      },
    },
  };
  const secondStore = {
    close() {},
    identity: {
      hasLocalIdentity() {
        return false;
      },
      getLocalIdentityKeyPair() {
        return createLocalIdentity('identity-public');
      },
    },
  };

  registerSignalBridgeLifecycleHandlers({
    ipcMain,
    bridgeState,
    getStore: () => store,
    setStore: (nextStore) => {
      store = nextStore;
    },
    getUserId: () => userId,
    setUserId: (nextUserId) => {
      userId = nextUserId;
    },
    async bootstrapLocalIdentity() {
      bootstrapCalls += 1;
    },
    async createProtocolStore(uid, masterKey) {
      createStoreCalls += 1;
      assert.equal(uid, 'user-1');
      assert.equal(Buffer.isBuffer(masterKey), true);
      return createStoreCalls === 1 ? firstStore : secondStore;
    },
    getMasterKey() {
      return {
        keyBase64: Buffer.alloc(32, 7).toString('base64'),
        requiresStoreReset: false,
      };
    },
    getOrCreateLocalDeviceId(uid) {
      assert.equal(uid, 'user-1');
      return 11;
    },
    normalizeDeviceId(value) {
      return Number.isInteger(Number(value)) ? Number(value) : null;
    },
    persistLocalDeviceId() {
      throw new Error('persistLocalDeviceId should not run during initialize');
    },
    createRandomDeviceId() {
      return 13;
    },
    resetSignalProtocolStore(uid) {
      resetUid = uid;
    },
    shouldResetProtocolStore(error) {
      return /bad decrypt/i.test(String(error?.message || ''));
    },
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
  });

  const result = await ipcMain.handlers.get('signal:initialize')(null, 'user-1');
  assert.deepEqual(result, {
    isNew: true,
    deviceId: 11,
    identityKeyPublic: Buffer.from('identity-public', 'utf8').toString('base64'),
  });
  assert.equal(createStoreCalls, 2);
  assert.equal(bootstrapCalls, 1);
  assert.equal(resetUid, 'user-1');
  assert.equal(firstStoreClosed, true);
  assert.equal(store, secondStore);
  assert.equal(userId, 'user-1');
  assert.equal(bridgeState.userId, 'user-1');
  assert.equal(warnings.length, 1);
});

test('signal bridge lifecycle runtime destroy handler closes store and clears bridge state', async () => {
  const ipcMain = createIpcMain();
  const bridgeState = {
    userId: 'user-2',
    localDeviceId: 17,
    localDeviceOwner: 'user-2',
  };
  let storeClosed = false;
  let store = {
    close() {
      storeClosed = true;
    },
  };
  let userId = 'user-2';

  registerSignalBridgeLifecycleHandlers({
    ipcMain,
    bridgeState,
    getStore: () => store,
    setStore: (nextStore) => {
      store = nextStore;
    },
    getUserId: () => userId,
    setUserId: (nextUserId) => {
      userId = nextUserId;
    },
    async bootstrapLocalIdentity() {},
    async createProtocolStore() {
      throw new Error('createProtocolStore should not run during destroy');
    },
    getMasterKey() {
      return { keyBase64: '', requiresStoreReset: false };
    },
    getOrCreateLocalDeviceId() {
      return 1;
    },
    normalizeDeviceId(value) {
      return value;
    },
    persistLocalDeviceId(value) {
      return value;
    },
    createRandomDeviceId() {
      return 2;
    },
    resetSignalProtocolStore() {},
    shouldResetProtocolStore() {
      return false;
    },
    logger: console,
  });

  await ipcMain.handlers.get('signal:destroy')();

  assert.equal(storeClosed, true);
  assert.equal(store, null);
  assert.equal(userId, null);
  assert.deepEqual(bridgeState, {
    userId: null,
    localDeviceId: null,
    localDeviceOwner: null,
  });
});

test('signal bridge lifecycle runtime device handlers use the shared device-id runtime canonically', async () => {
  const ipcMain = createIpcMain();
  const persistCalls = [];
  const randomValues = [5, 8];
  let userId = 'user-3';

  registerSignalBridgeLifecycleHandlers({
    ipcMain,
    bridgeState: {
      userId,
      localDeviceId: null,
      localDeviceOwner: null,
    },
    getStore: () => null,
    setStore() {},
    getUserId: () => userId,
    setUserId: (nextUserId) => {
      userId = nextUserId;
    },
    async bootstrapLocalIdentity() {},
    async createProtocolStore() {
      throw new Error('createProtocolStore should not run for device handlers');
    },
    getMasterKey() {
      return { keyBase64: '', requiresStoreReset: false };
    },
    getOrCreateLocalDeviceId(uid) {
      assert.equal(uid, 'user-3');
      return 7;
    },
    normalizeDeviceId(value) {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric >= 1 && numeric <= 127 ? numeric : null;
    },
    persistLocalDeviceId(deviceId, uid) {
      persistCalls.push({ deviceId, uid });
      return deviceId;
    },
    createRandomDeviceId() {
      return randomValues.shift();
    },
    resetSignalProtocolStore() {},
    shouldResetProtocolStore() {
      return false;
    },
    logger: console,
  });

  assert.equal(await ipcMain.handlers.get('signal:get-device-id')(), 7);
  assert.equal(await ipcMain.handlers.get('signal:set-device-id')(null, 9), 9);
  assert.equal(await ipcMain.handlers.get('signal:allocate-device-id')(null, ['5', 'invalid', 999]), 8);
  assert.deepEqual(persistCalls, [
    { deviceId: 9, uid: 'user-3' },
    { deviceId: 8, uid: 'user-3' },
  ]);
});

test('signal bridge lifecycle runtime reset-local-state handler clears persisted state for the target user', async () => {
  const ipcMain = createIpcMain();
  const bridgeState = {
    userId: 'user-4',
    localDeviceId: 6,
    localDeviceOwner: 'user-4',
  };
  let storeClosed = false;
  let store = {
    close() {
      storeClosed = true;
    },
  };
  let userId = 'user-4';
  const clears = [];

  registerSignalBridgeLifecycleHandlers({
    ipcMain,
    bridgeState,
    getStore: () => store,
    setStore: (nextStore) => {
      store = nextStore;
    },
    getUserId: () => userId,
    setUserId: (nextUserId) => {
      userId = nextUserId;
    },
    async bootstrapLocalIdentity() {},
    async createProtocolStore() {
      throw new Error('createProtocolStore should not run during reset-local-state');
    },
    getMasterKey() {
      return { keyBase64: '', requiresStoreReset: false };
    },
    getOrCreateLocalDeviceId() {
      return 1;
    },
    normalizeDeviceId(value) {
      return value;
    },
    persistLocalDeviceId(value) {
      return value;
    },
    clearPersistedLocalSignalState(uid) {
      clears.push(uid);
      bridgeState.localDeviceId = null;
      bridgeState.localDeviceOwner = null;
    },
    createRandomDeviceId() {
      return 2;
    },
    resetSignalProtocolStore() {},
    shouldResetProtocolStore() {
      return false;
    },
    logger: console,
  });

  const result = await ipcMain.handlers.get('signal:reset-local-state')(null, 'user-4');

  assert.equal(result, true);
  assert.equal(storeClosed, true);
  assert.equal(store, null);
  assert.equal(userId, null);
  assert.equal(bridgeState.userId, null);
  assert.equal(bridgeState.localDeviceId, null);
  assert.equal(bridgeState.localDeviceOwner, null);
  assert.deepEqual(clears, ['user-4']);
});
