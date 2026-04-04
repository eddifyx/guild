import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createSignalBridgeStateRuntime,
} = require('../../../client/electron/crypto/signalBridgeStateRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-signal-bridge-state-'));
}

test('signal bridge state runtime persists scoped device ids and migrates legacy device ids', () => {
  const userDataDir = createTmpUserDataDir();
  const state = {
    userId: 'user-1',
    localDeviceId: null,
    localDeviceOwner: null,
  };
  const runtime = createSignalBridgeStateRuntime({
    app: { getPath: () => userDataDir },
    cryptoRef: crypto,
    fs,
    path,
    state,
    logger: console,
  });

  assert.equal(runtime.normalizeDeviceId(1), 1);
  assert.equal(runtime.normalizeDeviceId(127), 127);
  assert.equal(runtime.normalizeDeviceId(0), null);
  assert.equal(runtime.normalizeDeviceId(128), null);
  assert.ok(runtime.createRandomDeviceId() >= 2);
  assert.ok(runtime.createRandomDeviceId() <= 127);

  const persisted = runtime.persistLocalDeviceId(7, 'user-1');
  assert.equal(persisted, 7);
  assert.equal(runtime.getOrCreateLocalDeviceId('user-1'), 7);
  assert.equal(state.localDeviceId, 7);
  assert.equal(state.localDeviceOwner, 'user-1');

  const legacyPath = runtime.legacyDeviceIdPath();
  fs.writeFileSync(legacyPath, JSON.stringify({ deviceId: 9 }));

  state.localDeviceId = null;
  state.localDeviceOwner = null;

  const migrated = runtime.getOrCreateLocalDeviceId('user-2');
  assert.equal(migrated, 9);
  assert.equal(state.localDeviceOwner, 'user-2');
  assert.equal(fs.existsSync(legacyPath), false);
  assert.equal(runtime.readPersistedDeviceId(runtime.deviceIdPath('user-2')), 9);
});

test('signal bridge state runtime manages master keys and protocol store cleanup through canonical files', () => {
  const userDataDir = createTmpUserDataDir();
  const warnings = [];
  const state = {
    userId: 'user-3',
    localDeviceId: null,
    localDeviceOwner: null,
  };
  const runtime = createSignalBridgeStateRuntime({
    app: { getPath: () => userDataDir },
    cryptoRef: crypto,
    fs,
    path,
    state,
    logger: { warn: (...args) => warnings.push(args) },
  });

  const firstMasterKey = runtime.getMasterKey('user-3');
  assert.equal(firstMasterKey.storage, 'fallback');
  assert.equal(firstMasterKey.requiresStoreReset, false);
  assert.equal(typeof firstMasterKey.keyBase64, 'string');
  assert.equal(fs.existsSync(runtime.fallbackMasterKeyPath('user-3')), true);

  fs.unlinkSync(runtime.fallbackMasterKeyPath('user-3'));
  fs.writeFileSync(runtime.encryptedMasterKeyPath('user-3'), 'legacy-key');
  const recoveredMasterKey = runtime.getMasterKey('user-3');
  assert.equal(recoveredMasterKey.storage, 'fallback-recovery');
  assert.equal(recoveredMasterKey.requiresStoreReset, true);
  assert.equal(fs.existsSync(runtime.fallbackMasterKeyPath('user-3')), true);
  assert.equal(warnings.length, 1);

  for (const filePath of runtime.protocolStorePaths('user-3')) {
    fs.writeFileSync(filePath, 'db');
  }
  assert.equal(runtime.hasLegacySignalState('user-3'), true);
  runtime.resetSignalProtocolStore('user-3');
  for (const filePath of runtime.protocolStorePaths('user-3')) {
    assert.equal(fs.existsSync(filePath), false);
  }
  assert.equal(runtime.shouldResetProtocolStore(new Error('bad decrypt')), true);
  assert.equal(runtime.shouldResetProtocolStore(new Error('ordinary failure')), false);
});

test('signal bridge state runtime prefers scoped ids and preserves legacy device id 1 when signal state exists', () => {
  const userDataDir = createTmpUserDataDir();
  const state = {
    userId: 'user-4',
    localDeviceId: null,
    localDeviceOwner: null,
  };
  const runtime = createSignalBridgeStateRuntime({
    app: { getPath: () => userDataDir },
    cryptoRef: crypto,
    fs,
    path,
    state,
    logger: console,
  });

  fs.writeFileSync(runtime.fallbackMasterKeyPath('user-4'), 'fallback-key\n');
  const deviceId = runtime.getOrCreateLocalDeviceId('user-4');
  assert.equal(deviceId, 1);
  assert.equal(runtime.readPersistedDeviceId(runtime.deviceIdPath('user-4')), 1);
});

test('signal bridge state runtime clears persisted local signal state for a scoped user', () => {
  const userDataDir = createTmpUserDataDir();
  const state = {
    userId: 'user-5',
    localDeviceId: 12,
    localDeviceOwner: 'user-5',
  };
  const runtime = createSignalBridgeStateRuntime({
    app: { getPath: () => userDataDir },
    cryptoRef: crypto,
    fs,
    path,
    state,
    logger: console,
  });

  runtime.persistLocalDeviceId(12, 'user-5');
  fs.writeFileSync(runtime.fallbackMasterKeyPath('user-5'), 'fallback-key\n');
  for (const filePath of runtime.protocolStorePaths('user-5')) {
    fs.writeFileSync(filePath, 'db');
  }

  runtime.clearPersistedLocalSignalState('user-5');

  assert.equal(fs.existsSync(runtime.deviceIdPath('user-5')), false);
  assert.equal(fs.existsSync(runtime.fallbackMasterKeyPath('user-5')), false);
  for (const filePath of runtime.protocolStorePaths('user-5')) {
    assert.equal(fs.existsSync(filePath), false);
  }
  assert.equal(state.localDeviceId, null);
  assert.equal(state.localDeviceOwner, null);
});
