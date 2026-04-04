import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildBrowserWindowOptions,
  getProfileWindowOffset,
  buildWindowRuntimeQuery,
} = require('../../../client/electron/electronWindowModel.js');

test('electron window model builds canonical query and BrowserWindow option contracts', () => {
  assert.deepEqual(buildWindowRuntimeQuery(null), null);
  assert.deepEqual(buildWindowRuntimeQuery('https://guild.test'), {
    serverUrl: 'https://guild.test',
  });

  assert.deepEqual(
    buildBrowserWindowOptions({
      appDisplayName: 'Guild',
      iconPath: '/tmp/icon.png',
      preloadPath: '/tmp/preload.js',
      profileId: null,
      profilePartition: 'persist:guild-default',
    }),
    {
      title: 'Guild',
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#0a0a0a',
      frame: false,
      icon: '/tmp/icon.png',
      webPreferences: {
        preload: '/tmp/preload.js',
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:guild-default',
        backgroundThrottling: false,
      },
    }
  );
});

test('electron window model offsets profile windows deterministically for multi-client launches', () => {
  assert.deepEqual(getProfileWindowOffset(null), null);
  assert.deepEqual(getProfileWindowOffset(''), null);
  assert.deepEqual(getProfileWindowOffset('A'), { x: 220, y: 170 });
  assert.deepEqual(getProfileWindowOffset('B'), { x: 40, y: 30 });

  const profileOptions = buildBrowserWindowOptions({
    appDisplayName: 'Guild',
    iconPath: '/tmp/icon.png',
    preloadPath: '/tmp/preload.js',
    profileId: 'A',
    profilePartition: 'persist:guild-profile-A',
  });

  assert.equal(profileOptions.x, 220);
  assert.equal(profileOptions.y, 170);
});
