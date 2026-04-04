import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  getScreenCaptureAccessStatus,
  openScreenCaptureSettings,
} = require('../../../client/electron/desktopSourceRuntime.js');
test('electron desktop source runtime resolves mac permission helpers canonically', async () => {
  let cache = { stale: true };
  const logs = [];

  const grantedStatus = getScreenCaptureAccessStatus({
    platform: 'darwin',
    systemPreferences: {
      getMediaAccessStatus() {
        return 'granted';
      },
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
  });

  const opened = await openScreenCaptureSettings({
    platform: 'darwin',
    openExternal: async (url) => {
      assert.equal(url, 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
  });

  assert.equal(grantedStatus, 'granted');
  assert.equal(opened, true);
  assert.deepEqual(cache, { stale: true });
});
