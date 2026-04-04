import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuthenticatedFileUrl,
  buildServerConnectionError,
  isInsecureServerUrl,
  migrateKnownServerUrl,
  normalizeConfiguredServerUrl,
  parseServerUrlList,
  toAbsoluteServerUrl,
} from '../../../client/src/features/api/serverUrlModel.mjs';

test('server url model normalizes and migrates configured production hosts', () => {
  const knownLegacyServerUrls = new Set(['http://legacy.guild.test']);

  assert.deepEqual(
    parseServerUrlList(' https://guild.test , http://legacy.guild.test ,,'),
    ['https://guild.test', 'http://legacy.guild.test']
  );

  assert.equal(
    migrateKnownServerUrl('http://legacy.guild.test', {
      canonicalServerUrl: 'https://guild.test',
      knownLegacyServerUrls,
    }),
    'https://guild.test'
  );

  assert.equal(
    normalizeConfiguredServerUrl('guild.test:3001', {
      migrateServerUrlFn: (value) => value,
    }),
    'http://guild.test:3001'
  );
});

test('server url model derives insecure state and absolutizes relative urls', () => {
  assert.equal(isInsecureServerUrl('http://guild.test'), true);
  assert.equal(isInsecureServerUrl('http://localhost:3001'), false);
  assert.equal(toAbsoluteServerUrl('/api/version', 'https://guild.test'), 'https://guild.test/api/version');
  assert.equal(toAbsoluteServerUrl('downloads/app.zip', 'https://guild.test'), 'https://guild.test/downloads/app.zip');
});

test('server url model protects auth tokens from external file origins', () => {
  assert.equal(
    buildAuthenticatedFileUrl({
      filePath: 'https://evil.test/uploads/steal.png',
      authToken: 'secret',
      serverUrl: 'https://guild.test',
    }),
    'https://evil.test/uploads/steal.png'
  );

  assert.equal(
    buildAuthenticatedFileUrl({
      filePath: '/uploads/file.png',
      authToken: 'secret',
      serverUrl: 'https://guild.test',
    }),
    'https://guild.test/uploads/file.png?token=secret'
  );
});

test('server url model wraps network fetch failures with a server-reachable message', () => {
  const networkError = new TypeError('Failed to fetch');
  const wrapped = buildServerConnectionError(networkError, 'https://guild.test');

  assert.equal(
    wrapped.message,
    'Cannot reach the /guild server at https://guild.test. Make sure it is running, then try again.'
  );

  const original = new Error('Nope');
  assert.equal(buildServerConnectionError(original, 'https://guild.test'), original);
});
