import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  applyBaseElectronAppSettings,
} = require('../../../client/electron/electronStartupAppSettingsRuntime.js');

function createAppStub() {
  const state = {
    disabledHardwareAcceleration: 0,
    lockRequests: [],
    setAppUserModelIds: [],
    switches: [],
  };

  const app = {
    commandLine: {
      appendSwitch(name, value) {
        state.switches.push([name, value]);
      },
    },
    disableHardwareAcceleration() {
      state.disabledHardwareAcceleration += 1;
    },
    requestSingleInstanceLock(payload) {
      state.lockRequests.push(payload);
      return true;
    },
    setAppUserModelId(value) {
      state.setAppUserModelIds.push(value);
    },
  };

  return { app, state };
}

test('electron startup app settings runtime applies switches and single-instance lock for the default profile', () => {
  const { app, state } = createAppStub();

  const gotTheLock = applyBaseElectronAppSettings({
    app,
    processRef: {
      env: {
        GUILD_DISABLE_HARDWARE_ACCELERATION: '1',
      },
    },
    productSlug: 'guild',
    profileId: null,
  });

  assert.equal(gotTheLock, true);
  assert.equal(state.disabledHardwareAcceleration, 1);
  assert.deepEqual(state.lockRequests, [{ profile: 'default' }]);
  assert.deepEqual(state.setAppUserModelIds, ['guild.default']);
  assert.deepEqual(state.switches, [
    ['autoplay-policy', 'no-user-gesture-required'],
    ['disable-renderer-backgrounding', undefined],
    ['disable-background-timer-throttling', undefined],
  ]);
});

test('electron startup app settings runtime skips the single-instance lock for named profiles', () => {
  const { app, state } = createAppStub();

  const gotTheLock = applyBaseElectronAppSettings({
    app,
    processRef: {
      env: {},
    },
    productSlug: 'guild',
    profileId: 'qa-main',
  });

  assert.equal(gotTheLock, true);
  assert.deepEqual(state.lockRequests, []);
  assert.deepEqual(state.setAppUserModelIds, ['guild.qa-main']);
});
