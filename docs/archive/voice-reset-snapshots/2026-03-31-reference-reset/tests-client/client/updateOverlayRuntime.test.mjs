import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginOverlayUpdate,
  downloadAndApplyOverlayUpdate,
  openUpdateOverlayExternal,
  subscribeToUpdateOverlayProgress,
} from '../../../client/src/features/update/updateOverlayRuntime.mjs';

test('update overlay runtime opens manual-install URLs without starting native update', async () => {
  const calls = [];

  const result = await beginOverlayUpdate({
    guildVoiceBridge: {
      leaveForUpdate: async () => {
        calls.push('left-voice');
      },
    },
    electronApi: {
      openExternal: (url) => calls.push(['open', url]),
    },
    isManualInstall: true,
    primaryDownloadUrl: 'https://guild.test/manual',
  });

  assert.deepEqual(calls, [
    'left-voice',
    ['open', 'https://guild.test/manual'],
  ]);
  assert.equal(result.startedNativeUpdate, false);
});

test('update overlay runtime leaves voice and starts native update path', async () => {
  const calls = [];

  const result = await beginOverlayUpdate({
    guildVoiceBridge: {
      leaveForUpdate: async () => {
        calls.push('left-voice');
      },
    },
    electronApi: {},
    isManualInstall: false,
  });

  assert.deepEqual(calls, ['left-voice']);
  assert.equal(result.startedNativeUpdate, true);
});

test('update overlay runtime forwards download/apply payloads and progress callbacks', async () => {
  const calls = [];
  let progressHandler = null;

  const electronApi = {
    onUpdateProgress: (handler) => {
      progressHandler = handler;
      return () => calls.push('cleanup');
    },
    downloadUpdate: async (payload) => {
      calls.push(['download', payload]);
      return { archivePath: '/tmp/guild.zip' };
    },
    applyUpdate: async (payload) => {
      calls.push(['apply', payload]);
    },
  };

  const cleanup = subscribeToUpdateOverlayProgress({
    electronApi,
    onProgress: (data) => calls.push(['progress', data]),
  });
  progressHandler?.({ phase: 'downloading', downloadedBytes: 5 });

  await downloadAndApplyOverlayUpdate({
    electronApi,
    serverUrl: 'https://guild.test',
    updateInfo: {
      platformDownload: {
        archiveUrl: 'https://guild.test/archive.zip',
      },
    },
  });

  cleanup?.();

  assert.deepEqual(calls, [
    ['progress', { phase: 'downloading', downloadedBytes: 5 }],
    ['download', {
      serverUrl: 'https://guild.test',
      archiveUrl: 'https://guild.test/archive.zip',
      platformDownload: {
        archiveUrl: 'https://guild.test/archive.zip',
      },
    }],
    ['apply', { archivePath: '/tmp/guild.zip' }],
    'cleanup',
  ]);
});

test('update overlay runtime safely ignores empty external URLs', () => {
  let opened = false;

  const result = openUpdateOverlayExternal({
    electronApi: {
      openExternal: () => {
        opened = true;
      },
    },
    url: '',
  });

  assert.equal(result, false);
  assert.equal(opened, false);
});
