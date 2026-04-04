import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildAboutPanelOptions,
  buildDisplayMediaHandlerOptions,
  createElectronAppLifecycleRuntime,
} = require('../../../client/electron/electronAppLifecycleRuntime.js');

test('electron app lifecycle runtime builds canonical about-panel and display-media contracts', () => {
  assert.deepEqual(
    buildAboutPanelOptions({
      appDisplayName: 'Guild',
      appVersion: '1.2.3',
    }),
    {
      applicationName: 'Guild',
      applicationVersion: '1.2.3',
      version: '1.2.3',
      copyright: '/guild encrypted messenger',
    }
  );

  const options = buildDisplayMediaHandlerOptions({
    appendDebugLog() {},
    clearPendingSourceId() {},
    desktopCapturer: { id: 'desktop' },
    getPendingSourceId: () => 'screen:123',
    platform: 'darwin',
  });
  assert.equal(options.platform, 'darwin');
  assert.equal(options.desktopCapturer.id, 'desktop');
  assert.equal(options.getPendingSourceId(), 'screen:123');
});

test('electron app lifecycle runtime registers ready, shutdown, and window lifecycle handlers through one shared shell', async () => {
  const handlers = new Map();
  const calls = {
    aboutPanelOptions: null,
    createWindow: 0,
    handleSecondInstance: [],
    installApplicationMenu: 0,
    primeAppleVoiceCapture: 0,
    quit: 0,
    readyShell: 0,
    registerDisplayMediaHandler: [],
    registerSignalHandlers: [],
    stopAppleVoiceCaptureSession: 0,
    timeoutCalls: [],
  };
  const beforeQuitCalls = [];
  let windowCount = 1;

  const app = {
    on(event, handler) {
      handlers.set(event, handler);
    },
    quit() {
      calls.quit += 1;
    },
    setAboutPanelOptions(options) {
      calls.aboutPanelOptions = options;
    },
    whenReady() {
      return {
        then(handler) {
          handlers.set('ready', handler);
        },
      };
    },
  };

  const runtime = createElectronAppLifecycleRuntime({
    app,
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    appendDebugLog() {},
    BrowserWindow: {
      getAllWindows() {
        return Array.from({ length: windowCount }, () => ({}));
      },
    },
    clearPendingSourceId() {},
    createWindow() {
      calls.createWindow += 1;
    },
    desktopCapturer: { id: 'desktop' },
    getPendingSourceId: () => 'screen:1',
    handleSecondInstance(commandLine) {
      calls.handleSecondInstance.push(commandLine);
    },
    installApplicationMenu() {
      calls.installApplicationMenu += 1;
    },
    ipcMain: { id: 'ipc' },
    isAppleVoiceCaptureSupported: () => true,
    logger: {
      warn(message) {
        beforeQuitCalls.push(['warn', message]);
      },
    },
    platform: 'win32',
    primeAppleVoiceCapture() {
      calls.primeAppleVoiceCapture += 1;
      return Promise.resolve();
    },
    profilePartition: 'persist:guild-default',
    registerDisplayMediaHandler(targetSession, options) {
      calls.registerDisplayMediaHandler.push([targetSession, options]);
    },
    registerSignalHandlers(ipcMain) {
      calls.registerSignalHandlers.push(ipcMain);
    },
    session: {
      defaultSession: { id: 'default' },
      fromPartition(partition) {
        return { id: partition };
      },
    },
    setupReadyShell() {
      calls.readyShell += 1;
    },
    stopAppleVoiceCaptureSession() {
      calls.stopAppleVoiceCaptureSession += 1;
    },
    additionalBeforeQuitHandlers: [
      () => beforeQuitCalls.push('cache'),
      () => beforeQuitCalls.push('snapshot'),
    ],
    setTimeoutFn(handler, delay) {
      calls.timeoutCalls.push(delay);
      handler();
    },
  });

  runtime.registerElectronAppLifecycle();

  assert.deepEqual(calls.aboutPanelOptions, buildAboutPanelOptions({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
  }));
  assert.equal(calls.installApplicationMenu, 1);

  handlers.get('second-instance')(null, ['--show-about']);
  assert.deepEqual(calls.handleSecondInstance, [['--show-about']]);

  await handlers.get('ready')();
  assert.equal(calls.createWindow, 1);
  assert.deepEqual(calls.registerSignalHandlers, [{ id: 'ipc' }]);
  assert.equal(calls.readyShell, 1);
  assert.equal(calls.primeAppleVoiceCapture, 1);
  assert.deepEqual(calls.timeoutCalls, [1200]);
  assert.deepEqual(
    calls.registerDisplayMediaHandler.map(([targetSession]) => targetSession.id),
    ['default', 'persist:guild-default']
  );
  assert.equal(calls.registerDisplayMediaHandler[0][1].getPendingSourceId(), 'screen:1');

  handlers.get('before-quit')();
  assert.equal(calls.stopAppleVoiceCaptureSession, 1);
  assert.deepEqual(beforeQuitCalls, ['cache', 'snapshot']);

  handlers.get('window-all-closed')();
  assert.equal(calls.quit, 1);

  handlers.get('activate')();
  assert.equal(calls.createWindow, 1);
  windowCount = 0;
  handlers.get('activate')();
  assert.equal(calls.createWindow, 2);
});
