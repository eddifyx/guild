const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDownloadPageState,
  buildDownloadPageHtml,
} = require('../../../server/src/startup/downloadPageModel');

function createRequest({
  host = 'guild.test',
  forwardedProto = 'https',
} = {}) {
  return {
    get(header) {
      if (header === 'host') return host;
      if (header === 'x-forwarded-proto') return forwardedProto;
      return undefined;
    },
  };
}

test('download page model resolves mac/windows version state from platform overrides', () => {
  const state = buildDownloadPageState(createRequest(), {
    version: '1.0.0',
    platformOverrides: {
      'darwin-arm64': { version: '1.0.2' },
      'win32-x64': { version: '1.0.1' },
    },
  }, {
    updatesDir: '/updates',
    existsSyncFn: () => true,
    buildUpdateDownloadsFn: (req, version) => ({
      'darwin-arm64': {
        label: 'Mac Apple Silicon',
        installerUrl: `https://guild.test/mac/${version}.dmg`,
        archiveUrl: `https://guild.test/mac/${version}.zip`,
      },
      'win32-x64': {
        label: 'Windows 10 x64',
        installerUrl: `https://guild.test/win/${version}.zip`,
        archiveUrl: `https://guild.test/win/${version}.zip`,
      },
    }),
  });

  assert.equal(state.macVersion, '1.0.2');
  assert.equal(state.windowsVersion, '1.0.1');
  assert.equal(state.latestVersion, '1.0.2');
  assert.equal(state.macDownload.installerUrl, 'https://guild.test/mac/1.0.2.dmg');
  assert.equal(state.windowsDownload.installerUrl, 'https://guild.test/win/1.0.1.zip');
});

test('download page model renders download actions and empty state correctly', () => {
  const htmlWithDownloads = buildDownloadPageHtml({
    macDownload: {
      label: 'Mac Apple Silicon',
      installerUrl: 'https://guild.test/mac.dmg',
      archiveUrl: 'https://guild.test/mac.zip',
    },
    windowsDownload: {
      label: 'Windows 10 x64',
      installerUrl: 'https://guild.test/win.zip',
      archiveUrl: 'https://guild.test/win.zip',
    },
    macVersion: '1.0.2',
    windowsVersion: '1.0.1',
    latestVersion: '1.0.2',
  });

  assert.match(htmlWithDownloads, /Download DMG/);
  assert.match(htmlWithDownloads, /Download ZIP/);
  assert.match(htmlWithDownloads, /Current version: 1\.0\.2/);
  assert.match(htmlWithDownloads, /Latest published version across platforms: 1\.0\.2/);

  const emptyHtml = buildDownloadPageHtml({
    macDownload: { label: 'Mac Apple Silicon', installerUrl: null, archiveUrl: null },
    windowsDownload: { label: 'Windows 10 x64', installerUrl: null, archiveUrl: null },
    macVersion: '0.0.0',
    windowsVersion: '0.0.0',
    latestVersion: '0.0.0',
  });

  assert.match(emptyHtml, /No release downloads have been published yet/);
});
