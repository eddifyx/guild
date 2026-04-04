import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  SIGNER_STATE_FILE_NAME,
  createSignerStateRuntime,
  getSignerStateFilePath,
  normalizeSignerState,
} = require('../../../client/electron/signerStateRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-signer-state-secure-'));
}

test('encrypted signer-state runtime persists signer state through protected storage', () => {
  const userDataDir = createTmpUserDataDir();
  const safeStorage = {
    isEncryptionAvailable() {
      return true;
    },
    encryptString(value) {
      return Buffer.from(`enc:${value}`, 'utf8');
    },
    decryptString(value) {
      return Buffer.from(value).toString('utf8').replace(/^enc:/, '');
    },
  };

  const runtime = createSignerStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage,
    logger: console,
  });

  const signerState = {
    mode: 'nip46',
    clientSecretKey: 'CQk=',
    userPubkey: 'pubkey-2',
    bunkerPointer: {
      pubkey: 'bunker-pubkey-2',
      secret: 'qr-secret-2',
      relays: ['wss://relay.example'],
    },
  };

  assert.equal(
    getSignerStateFilePath({
      app: { getPath: () => userDataDir },
      path,
    }),
    path.join(userDataDir, SIGNER_STATE_FILE_NAME)
  );
  assert.equal(runtime.writeSignerState(signerState), true);
  assert.deepEqual(runtime.readSignerState(), normalizeSignerState(signerState));
  assert.equal(runtime.clearSignerState(), true);
  assert.equal(fs.existsSync(path.join(userDataDir, SIGNER_STATE_FILE_NAME)), false);
});
