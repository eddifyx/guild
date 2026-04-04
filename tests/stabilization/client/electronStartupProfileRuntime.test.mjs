import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  configureProfilePaths,
} = require('../../../client/electron/electronStartupProfileRuntime.js');

function createAppStub({ userDataPath = '/tmp/Guild/UserData' } = {}) {
  const state = {
    paths: new Map([['userData', userDataPath]]),
    setPathCalls: [],
    switches: [],
  };

  const app = {
    commandLine: {
      appendSwitch(name, value) {
        state.switches.push([name, value]);
      },
    },
    getPath(name) {
      return state.paths.get(name);
    },
    setPath(name, value) {
      state.paths.set(name, value);
      state.setPathCalls.push([name, value]);
    },
  };

  return { app, state };
}

test('electron startup profile runtime configures profile directories, app paths, and partition name', () => {
  const { app, state } = createAppStub();
  const mkdirCalls = [];

  const profilePartition = configureProfilePaths({
    app,
    fs: {
      mkdirSync(targetPath, options) {
        mkdirCalls.push([targetPath, options]);
      },
    },
    path,
    productSlug: 'guild',
    profileId: 'qa-main',
  });

  assert.equal(profilePartition, 'persist:guild-profile-qa-main');
  assert.deepEqual(
    mkdirCalls.map(([targetPath]) => targetPath),
    [
      '/tmp/Guild/UserData-profile-qa-main',
      '/tmp/Guild/UserData-profile-qa-main/session',
      '/tmp/Guild/UserData-profile-qa-main/logs',
      '/tmp/Guild/UserData-profile-qa-main/cache',
    ]
  );
  assert.deepEqual(
    state.setPathCalls,
    [
      ['userData', '/tmp/Guild/UserData-profile-qa-main'],
      ['sessionData', '/tmp/Guild/UserData-profile-qa-main/session'],
      ['logs', '/tmp/Guild/UserData-profile-qa-main/logs'],
    ]
  );
  assert.deepEqual(
    state.switches,
    [
      ['user-data-dir', '/tmp/Guild/UserData-profile-qa-main'],
      ['disk-cache-dir', '/tmp/Guild/UserData-profile-qa-main/cache'],
    ]
  );
});

test('electron startup profile runtime keeps the default partition when no profile is active', () => {
  const { app, state } = createAppStub();

  const profilePartition = configureProfilePaths({
    app,
    fs: {
      mkdirSync() {
        throw new Error('should not create profile directories without a profile');
      },
    },
    path,
    productSlug: 'guild',
    profileId: null,
  });

  assert.equal(profilePartition, 'persist:guild-default');
  assert.deepEqual(state.setPathCalls, []);
  assert.deepEqual(state.switches, []);
});
