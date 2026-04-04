import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLatestVersionFailure,
  buildLatestVersionResult,
  hasRemoteVersionUpdate,
} from '../../../client/src/features/api/versionCheckRuntime.mjs';

test('version check runtime compares version triplets safely', () => {
  assert.equal(hasRemoteVersionUpdate('1.2.3', '1.2.4'), true);
  assert.equal(hasRemoteVersionUpdate('1.2.3', '1.2.3'), false);
  assert.equal(hasRemoteVersionUpdate('2.0.0', '1.9.9'), false);
});

test('version check runtime shapes platform downloads and manual-install metadata', () => {
  const result = buildLatestVersionResult({
    payload: {
      version: '1.2.4',
      updateStrategy: 'manual-install',
      manualInstallReason: 'Signed installer required',
      downloadPageUrl: '/downloads',
      releasedAt: 'March 25, 2026',
      patchNotes: ['Voice fixes'],
      downloads: {
        'darwin-arm64': {
          installerUrl: '/installers/guild.dmg',
          archiveUrl: '/updates/guild.zip',
        },
      },
    },
    localVersion: '1.2.3',
    platform: 'darwin-arm64',
    serverUrl: 'https://guild.test',
  });

  assert.deepEqual(result, {
    hasUpdate: true,
    localVersion: '1.2.3',
    remoteVersion: '1.2.4',
    updateStrategy: 'manual-install',
    manualInstallReason: 'Signed installer required',
    downloadPageUrl: 'https://guild.test/downloads',
    platformDownload: {
      installerUrl: 'https://guild.test/installers/guild.dmg',
      archiveUrl: 'https://guild.test/updates/guild.zip',
    },
    releasedAt: 'March 25, 2026',
    patchNotes: ['Voice fixes'],
  });
});

test('version check runtime exposes a stable failure shape', () => {
  assert.deepEqual(
    buildLatestVersionFailure('1.2.3'),
    {
      hasUpdate: false,
      localVersion: '1.2.3',
      remoteVersion: null,
      updateStrategy: 'native',
      manualInstallReason: null,
      downloadPageUrl: null,
      platformDownload: null,
      releasedAt: null,
      patchNotes: null,
    }
  );
});
