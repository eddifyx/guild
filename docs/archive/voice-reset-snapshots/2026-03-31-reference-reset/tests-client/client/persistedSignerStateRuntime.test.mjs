import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  SIGNER_STATE_FILE_NAME,
  createPersistedSignerStateRuntime,
  getSignerStateFilePath,
  normalizeSignerState,
} = require('../../../client/electron/persistedSignerStateRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-signer-state-'));
}

test('persisted signer-state runtime normalizes and persists signer state canonically', () => {
  const userDataDir = createTmpUserDataDir();
  const runtime = createPersistedSignerStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
  });

  const signerState = {
    mode: 'nip46',
    clientSecretKey: 'AQID',
    userPubkey: 'pubkey-user-1',
    bunkerPointer: {
      pubkey: 'pubkey-1',
      secret: 'qr-secret-1',
      relays: ['wss://relay.example', 42],
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
