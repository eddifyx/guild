import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  detectRuntimeAppFlavor,
  getRuntimeProfile,
  getRuntimeServerUrl,
  sanitizeProfileId,
  sanitizeServerUrl,
} = require('../../../client/electron/electronStartupModel.js');

test('electron startup model sanitizes profile and server runtime inputs', () => {
  assert.equal(sanitizeProfileId('  guild staging!!  '), 'guild-staging');
  assert.equal(sanitizeProfileId(''), null);
  assert.equal(sanitizeServerUrl('https://guild.test///'), 'https://guild.test');
  assert.equal(sanitizeServerUrl('guild.test'), null);

  assert.equal(
    getRuntimeProfile(['node', 'main.js', '--profile=qa-build'], {}),
    'qa-build'
  );
  assert.equal(
    getRuntimeServerUrl(['node', 'main.js', '--server-url', 'https://guild.test/'], {}),
    'https://guild.test'
  );

  assert.equal(
    detectRuntimeAppFlavor({
      app: { getName: () => 'Guild', getAppPath: () => '/Applications/guild-staging.app' },
      processRef: { env: {}, execPath: '/Applications/guild-staging.app' },
    }),
    'staging'
  );
});
