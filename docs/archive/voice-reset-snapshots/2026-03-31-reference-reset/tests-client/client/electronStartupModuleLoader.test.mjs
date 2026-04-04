import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  loadAppFlavorConfig,
  loadSignalBridge,
  requireFirstExistingModule,
} = require('../../../client/electron/electronStartupModuleLoader.js');

test('electron startup module loader loads the first available config and bridge modules canonically', () => {
  const baseDir = '/workspace/guild-main';
  const loaded = new Map();
  const configPath = path.join(baseDir, 'config', 'appFlavor.js');
  const bridgePath = path.join(baseDir, 'client', 'electron', 'crypto', 'signalBridge.js');

  loaded.set(configPath, { getAppFlavor: () => ({ productSlug: 'guild' }) });
  loaded.set(bridgePath, { registerSignalHandlers: () => {} });

  const fs = {
    existsSync(candidate) {
      return loaded.has(candidate);
    },
  };
  const requireFn = (candidate) => loaded.get(candidate);

  assert.equal(
    loadAppFlavorConfig({ baseDir, fs, path, requireFn }).getAppFlavor().productSlug,
    'guild'
  );
  assert.equal(
    typeof loadSignalBridge({ baseDir, fs, path, requireFn }).registerSignalHandlers,
    'function'
  );
});

test('electron startup module loader surfaces checked candidates when no module exists', () => {
  assert.throws(
    () => requireFirstExistingModule({
      candidates: ['/tmp/one.js', '/tmp/two.js'],
      errorMessage: 'missing module',
      fs: { existsSync: () => false },
      requireFn: () => {
        throw new Error('should not load');
      },
    }),
    /missing module\. Checked: \/tmp\/one\.js, \/tmp\/two\.js/
  );
});
