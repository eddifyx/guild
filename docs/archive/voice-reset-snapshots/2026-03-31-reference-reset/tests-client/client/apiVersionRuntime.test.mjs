import test from 'node:test';
import assert from 'node:assert/strict';

import { checkLatestVersion } from '../../../client/src/features/api/apiVersionRuntime.mjs';

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('api version runtime asks the configured server for the current platform build', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;

  const localStorage = createLocalStorage();
  const fetchCalls = [];

  globalThis.window = {
    location: { search: '' },
    localStorage,
    electronAPI: {
      getAppVersion: () => '1.2.3',
      getPlatformTarget: () => 'darwin-arm64',
    },
  };
  globalThis.localStorage = localStorage;
  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    return {
      ok: true,
      json: async () => ({
        version: '1.2.4',
        updateStrategy: 'manual-install',
        downloadPageUrl: '/downloads',
        downloads: {
          'darwin-arm64': {
            installerUrl: '/installers/guild.dmg',
            archiveUrl: '/updates/guild.zip',
          },
        },
      }),
      statusText: 'OK',
    };
  };

  try {
    localStorage.setItem('serverUrl', 'https://guild.test');

    assert.deepEqual(await checkLatestVersion(), {
      hasUpdate: true,
      localVersion: '1.2.3',
      remoteVersion: '1.2.4',
      updateStrategy: 'manual-install',
      manualInstallReason: null,
      downloadPageUrl: 'https://guild.test/downloads',
      platformDownload: {
        installerUrl: 'https://guild.test/installers/guild.dmg',
        archiveUrl: 'https://guild.test/updates/guild.zip',
      },
      releasedAt: null,
      patchNotes: null,
    });

    assert.equal(
      fetchCalls[0],
      'https://guild.test/api/version?platform=darwin-arm64&localVersion=1.2.3'
    );
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
  }
});
