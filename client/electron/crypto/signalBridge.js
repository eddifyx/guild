/**
 * /guild — libsignal IPC Bridge
 *
 * Registers ipcMain handlers for all crypto operations. The renderer
 * calls these via window.signalCrypto (exposed in preload.js).
 *
 * All key material stays in the main process. The renderer only ever
 * sees plaintext and opaque ciphertext blobs.
 */

const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { registerSignalBridgeBundleHandlers } = require('./signalBridgeBundleRuntime');
const { createProtocolStore } = require('./signalStore');
const { registerSignalBridgeGroupHandlers } = require('./signalBridgeGroupRuntime');
const { registerSignalBridgeIdentityHandlers } = require('./signalBridgeIdentityRuntime');
const { registerSignalBridgeLifecycleHandlers } = require('./signalBridgeLifecycleRuntime');
const { registerSignalBridgeSessionHandlers } = require('./signalBridgeSessionRuntime');
const { createSignalBridgeStateRuntime } = require('./signalBridgeStateRuntime');
const { importLibsignalModule } = require('./runtimeModules');
let signalModulePromise = null;

async function getSignalModule() {
  if (!signalModulePromise) {
    signalModulePromise = importLibsignalModule();
  }

  return signalModulePromise;
}

const OTP_BATCH_SIZE = 100;
const KYBER_BATCH_SIZE = 20;

let store = null;
let userId = null;
const signalBridgeState = {
  userId: null,
  localDeviceId: null,
  localDeviceOwner: null,
};
const {
  createRandomDeviceId,
  clearPersistedLocalSignalState,
  getMasterKey,
  getOrCreateLocalDeviceId,
  normalizeDeviceId,
  persistLocalDeviceId,
  resetSignalProtocolStore,
  shouldResetProtocolStore,
} = createSignalBridgeStateRuntime({
  app,
  cryptoRef: crypto,
  fs,
  path,
  state: signalBridgeState,
  logger: console,
});

// ---------------------------------------------------------------------------
// Master key management.
// Runtime builds intentionally avoid Electron safeStorage / OS keychain.
// The Signal master key is persisted only to an app-local base64 file.
// If we detect a legacy keychain-backed file from older builds, we rotate
// to app-local storage and reset the local Signal store once.
// ---------------------------------------------------------------------------

async function bootstrapLocalIdentity(store) {
  const { IdentityKeyPair } = await getSignalModule();
  const identityKeyPair = IdentityKeyPair.generate();
  const registrationId = (crypto.randomInt(16383) + 1); // 1-16383

  store.identity.saveLocalIdentity(identityKeyPair, registrationId);

  const preKeys = await generatePreKeys(1, OTP_BATCH_SIZE);
  for (const pk of preKeys) {
    await store.preKey.savePreKey(pk.id(), pk);
  }

  const spk = await generateSignedPreKey(identityKeyPair, 1);
  await store.signedPreKey.saveSignedPreKey(spk.id(), spk);

  for (let i = 0; i < KYBER_BATCH_SIZE; i++) {
    const kpk = await generateKyberPreKey(identityKeyPair, i + 1);
    await store.kyberPreKey.saveKyberPreKey(kpk.id(), kpk);
  }

  return identityKeyPair;
}

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

async function generatePreKeys(startId, count) {
  const { PrivateKey, PreKeyRecord } = await getSignalModule();
  const records = [];
  for (let i = 0; i < count; i++) {
    const id = startId + i;
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    const record = PreKeyRecord.new(id, publicKey, privateKey);
    records.push(record);
  }
  return records;
}

async function generateSignedPreKey(identityKeyPair, id) {
  const { PrivateKey, SignedPreKeyRecord } = await getSignalModule();
  const timestamp = Date.now();
  const privateKey = PrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const signature = identityKeyPair.privateKey.sign(
    Buffer.from(publicKey.serialize())
  );
  return SignedPreKeyRecord.new(id, timestamp, publicKey, privateKey, signature);
}

async function generateKyberPreKey(identityKeyPair, id) {
  const { KEMKeyPair, KyberPreKeyRecord } = await getSignalModule();
  const timestamp = Date.now();
  const keyPair = KEMKeyPair.generate();
  const signature = identityKeyPair.privateKey.sign(
    Buffer.from(keyPair.getPublicKey().serialize())
  );
  return KyberPreKeyRecord.new(id, timestamp, keyPair, signature);
}

// ---------------------------------------------------------------------------
// IPC Handler Registration
// ---------------------------------------------------------------------------

function registerSignalHandlers(ipcMain) {
  registerSignalBridgeLifecycleHandlers({
    ipcMain,
    bridgeState: signalBridgeState,
    getStore: () => store,
    setStore: (nextStore) => {
      store = nextStore;
    },
    getUserId: () => userId,
    setUserId: (nextUserId) => {
      userId = nextUserId;
    },
    bootstrapLocalIdentity,
    createProtocolStore,
    getMasterKey,
    getOrCreateLocalDeviceId,
    normalizeDeviceId,
    persistLocalDeviceId,
    clearPersistedLocalSignalState,
    createRandomDeviceId,
    resetSignalProtocolStore,
    shouldResetProtocolStore,
    logger: console,
  });

  registerSignalBridgeIdentityHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => userId,
    getSignalModule,
    normalizeDeviceId,
  });

  registerSignalBridgeBundleHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => userId,
    getOrCreateLocalDeviceId,
    generatePreKeys,
    generateKyberPreKey,
    otpBatchSize: OTP_BATCH_SIZE,
    kyberBatchSize: KYBER_BATCH_SIZE,
  });

  registerSignalBridgeGroupHandlers({
    ipcMain,
    getStore: () => store,
    getUserId: () => userId,
    getSignalModule,
  });

  registerSignalBridgeSessionHandlers({
    ipcMain,
    getStore: () => store,
    getSignalModule,
    normalizeDeviceId,
  });

}

module.exports = { registerSignalHandlers };
