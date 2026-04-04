import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronStartupRuntime,
  detectRuntimeAppFlavor,
  getRuntimeProfile,
  getRuntimeServerUrl,
  sanitizeProfileId,
  sanitizeServerUrl,
} = require('../../../client/electron/electronStartupRuntime.js');

function createAppStub({ userDataPath = '/tmp/Guild/UserData' } = {}) {
  const state = {
    disabledHardwareAcceleration: 0,
    lockRequests: [],
    name: null,
    paths: new Map([['userData', userDataPath]]),
    setAppUserModelIds: [],
    setPathCalls: [],
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
    getAppPath() {
      return '/Applications/Guild.app';
    },
    getName() {
      return state.name;
    },
    getPath(name) {
      return state.paths.get(name);
    },
    requestSingleInstanceLock(payload) {
      state.lockRequests.push(payload);
      return true;
    },
    setAppUserModelId(value) {
      state.setAppUserModelIds.push(value);
    },
    setName(value) {
      state.name = value;
    },
    setPath(name, value) {
      state.paths.set(name, value);
      state.setPathCalls.push([name, value]);
    },
  };

  return { app, state };
}

test('electron startup runtime sanitizes profile and server runtime inputs', () => {
  assert.equal(sanitizeProfileId('  guild staging!!  '), 'guild-staging');
  assert.equal(sanitizeProfileId(''), null);
  assert.equal(sanitizeServerUrl('https://guild.test///'), 'https://guild.test');
  assert.equal(sanitizeServerUrl('guild.test'), null);

  assert.equal(
    getRuntimeProfile(['node', 'main.js', '--profile=qa-build'], {}),
    'qa-build'
  );
  assert.equal(
    getRuntimeServerUrl(['node', 'main.js', '--server-url', 'https://guild.test/'], {}),
    'https://guild.test'
  );

  assert.equal(
    detectRuntimeAppFlavor({
      app: { getName: () => 'Guild', getAppPath: () => '/Applications/guild-staging.app' },
      processRef: { env: {}, execPath: '/Applications/guild-staging.app' },
    }),
    'staging'
  );
});

test('electron startup runtime configures flavor, profile paths, switches, and bridge loading for the repo root shell', () => {
  const { app, state } = createAppStub();
  const mkdirCalls = [];
  const requiredModules = new Map();
  const baseDir = '/workspace/guild-main';
  const configPath = path.join(baseDir, 'config', 'appFlavor.js');
  const bridgePath = path.join(baseDir, 'client', 'electron', 'crypto', 'signalBridge.js');
  const registerSignalHandlers = () => {};

  requiredModules.set(configPath, {
    getAppFlavor() {
      return {
        appName: 'Guild',
        uiName: 'Guild',
        productSlug: 'guild',
        legacyUpdateSlug: 'guild-old',
        menuName: 'Guild',
      };
    },
  });
  requiredModules.set(bridgePath, { registerSignalHandlers });

  const runtime = createElectronStartupRuntime({
    app,
    fs: {
      existsSync(candidate) {
        return requiredModules.has(candidate);
      },
      mkdirSync(targetPath, options) {
        mkdirCalls.push([targetPath, options]);
      },
    },
    path,
    processRef: {
      argv: ['node', 'main.js', '--server-url', 'https://guild.test/socket/'],
      env: {
        BYZANTINE_PROFILE: 'qa-main',
        GUILD_DISABLE_HARDWARE_ACCELERATION: '1',
      },
      execPath: '/Applications/Guild.app/Contents/MacOS/Guild',
    },
    requireFn(candidate) {
      return requiredModules.get(candidate);
    },
    baseDir,
  });

  const startup = runtime.configureElectronStartup();

  assert.equal(startup.productSlug, 'guild');
  assert.equal(startup.profileId, 'qa-main');
  assert.equal(startup.runtimeServerUrl, 'https://guild.test/socket');
  assert.equal(startup.profilePartition, 'persist:guild-profile-qa-main');
  assert.equal(startup.registerSignalHandlers, registerSignalHandlers);
  assert.equal(state.name, 'Guild');
  assert.equal(state.disabledHardwareAcceleration, 1);
  assert.equal(state.lockRequests.length, 0);
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
      ['autoplay-policy', 'no-user-gesture-required'],
      ['disable-renderer-backgrounding', undefined],
      ['disable-background-timer-throttling', undefined],
    ]
  );
  assert.deepEqual(state.setAppUserModelIds, ['guild.qa-main']);
});
