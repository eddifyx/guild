import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerAppControlIpcHandlers,
} = require('../../../client/electron/electronAppControlIpcRuntime.js');

function createIpcMainStub() {
  const handles = new Map();
  const handlers = new Map();
  return {
    handle(channel, fn) {
      handles.set(channel, fn);
    },
    on(channel, fn) {
      handlers.set(channel, fn);
    },
    __handles: handles,
    __handlers: handlers,
  };
}

test('app control IPC runtime registers window controls and app info handlers', () => {
  const warnings = [];
  const ipcMain = createIpcMainStub();
  const mainWindow = {
    minimized: false,
    maximized: false,
    closed: 0,
    minimize() {
      this.minimized = true;
    },
    isMaximized() {
      return this.maximized;
    },
    maximize() {
      this.maximized = true;
    },
    unmaximize() {
      this.maximized = false;
    },
    close() {
      this.closed += 1;
    },
  };

  registerAppControlIpcHandlers({
    app: {
      getGPUFeatureStatus() {
        return { webgl: 'enabled' };
      },
      isHardwareAccelerationEnabled() {
        return true;
      },
      quit() {
        warnings.push(['quit']);
      },
      relaunch() {
        warnings.push(['relaunch']);
      },
    },
    appFlavorId: 'staging',
    appVersion: '1.2.3',
    getMainWindow() {
      return mainWindow;
    },
    ipcMain,
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
  });

  assert.equal(ipcMain.__handles.get('window-minimize')(), undefined);
  assert.equal(mainWindow.minimized, true);
  assert.equal(ipcMain.__handles.get('window-maximize')(), undefined);
  assert.equal(mainWindow.maximized, true);
  assert.equal(ipcMain.__handles.get('window-maximize')(), undefined);
  assert.equal(mainWindow.maximized, false);
  assert.equal(ipcMain.__handles.get('window-close')(), undefined);
  assert.equal(mainWindow.closed, 1);
  assert.equal(ipcMain.__handles.get('app-relaunch')(), true);
  assert.deepEqual(warnings.slice(0, 2), [['relaunch'], ['quit']]);

  assert.equal(ipcMain.__handles.get('get-app-version')(), '1.2.3');
  const flavorEvent = {};
  ipcMain.__handlers.get('get-app-flavor-sync')(flavorEvent);
  assert.equal(flavorEvent.returnValue, 'staging');
  const hardwareEvent = {};
  ipcMain.__handlers.get('get-hardware-acceleration-enabled-sync')(hardwareEvent);
  assert.equal(hardwareEvent.returnValue, true);
  const gpuEvent = {};
  ipcMain.__handlers.get('get-gpu-feature-status-sync')(gpuEvent);
  assert.deepEqual(gpuEvent.returnValue, { webgl: 'enabled' });
});

test('app control IPC runtime safely handles relaunch and sync getter failures', () => {
  const warnings = [];
  const ipcMain = createIpcMainStub();

  registerAppControlIpcHandlers({
    app: {
      getGPUFeatureStatus() {
        throw new Error('gpu');
      },
      isHardwareAccelerationEnabled() {
        throw new Error('hardware');
      },
      quit() {},
      relaunch() {
        throw new Error('relaunch');
      },
    },
    appFlavorId: 'production',
    appVersion: '9.9.9',
    getMainWindow() {
      return null;
    },
    ipcMain,
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
  });

  assert.equal(ipcMain.__handles.get('app-relaunch')(), false);
  const hardwareEvent = {};
  ipcMain.__handlers.get('get-hardware-acceleration-enabled-sync')(hardwareEvent);
  assert.equal(hardwareEvent.returnValue, null);
  const gpuEvent = {};
  ipcMain.__handlers.get('get-gpu-feature-status-sync')(gpuEvent);
  assert.equal(gpuEvent.returnValue, null);
  assert.equal(warnings.length, 1);
});
