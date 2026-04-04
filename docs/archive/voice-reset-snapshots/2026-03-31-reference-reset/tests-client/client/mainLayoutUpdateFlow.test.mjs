import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMainLayoutUpdateAction } from '../../../client/src/features/layout/mainLayoutUpdateFlow.mjs';

test('main layout update flow opens the overlay immediately when update data is already available', async () => {
  const updates = [];

  const result = await handleMainLayoutUpdateAction({
    updateAvailable: true,
    latestVersionInfo: { hasUpdate: true, version: '1.2.3' },
    setShowUpdateOverlayFn: (value) => updates.push(['overlay', value]),
  });

  assert.deepEqual(updates, [['overlay', true]]);
  assert.equal(result.action, 'open-overlay');
});

test('main layout update flow refreshes before opening updates or showing the up-to-date toast', async () => {
  const updates = [];
  const timeouts = [];

  const openResult = await handleMainLayoutUpdateAction({
    updateAvailable: false,
    appVersion: '1.0.70',
    refreshLatestVersionInfoFn: async () => ({ hasUpdate: true, version: '1.0.71' }),
    setShowUpdateOverlayFn: (value) => updates.push(['overlay', value]),
  });

  const toastResult = await handleMainLayoutUpdateAction({
    updateAvailable: false,
    appVersion: '1.0.70',
    refreshLatestVersionInfoFn: async () => ({ hasUpdate: false }),
    setVersionToastFn: (value) => updates.push(['toast', value]),
    setTimeoutFn: (callback, duration) => {
      timeouts.push(duration);
      callback();
    },
  });

  assert.equal(openResult.action, 'open-overlay');
  assert.equal(toastResult.action, 'show-toast');
  assert.deepEqual(updates, [
    ['overlay', true],
    ['toast', "You're up to date (v1.0.70)"],
    ['toast', null],
  ]);
  assert.deepEqual(timeouts, [3000]);
});
