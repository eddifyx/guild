import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronWindowReadyShellRuntime,
} = require('../../../client/electron/electronWindowReadyShellRuntime.js');

function createBrowserWindowStub() {
  const webContentsHandlers = new Map();

  return {
    webContents: {
      once(event, handler) {
        webContentsHandlers.set(`once:${event}`, handler);
      },
    },
    __webContentsHandlers: webContentsHandlers,
  };
}

test('electron window ready shell runtime handles user tasks, tray wiring, and deferred about display', () => {
  const aboutCalls = [];
  const userTasks = [];
  const trayEvents = [];
  const trayState = {};
  const browserWindow = createBrowserWindowStub();

  function Tray(iconPath) {
    trayState.iconPath = iconPath;
    return {
      setToolTip(value) {
        trayState.tooltip = value;
      },
      setContextMenu(menu) {
        trayState.menu = menu;
      },
      on(event, handler) {
        trayEvents.push([event, handler]);
      },
    };
  }

  const runtime = createElectronWindowReadyShellRuntime({
    app: {
      quit() {
        trayState.quit = true;
      },
      setUserTasks(tasks) {
        userTasks.push(tasks);
      },
      showAboutPanel() {},
    },
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    focusMainWindow() {
      trayState.focused = (trayState.focused || 0) + 1;
    },
    getMainWindow: () => browserWindow,
    Menu: {
      buildFromTemplate(template) {
        return { template };
      },
    },
    processRef: {
      platform: 'win32',
      argv: ['electron', '--show-about'],
      execPath: '/tmp/Guild.exe',
    },
    profileId: 'staging',
    resolveFlavorAssetPath: () => '/tmp/icon.png',
    setTray() {},
    showAboutDialog() {
      aboutCalls.push(true);
    },
    Tray,
  });

  runtime.setupReadyShell();

  assert.equal(userTasks.length, 1);
  assert.equal(userTasks[0][0].arguments, '--profile=staging --show-about');
  assert.equal(trayState.iconPath, '/tmp/icon.png');
  assert.equal(trayState.tooltip, 'Guild v1.2.3');
  assert.equal(typeof trayEvents[0][1], 'function');
  assert.equal(typeof browserWindow.__webContentsHandlers.get('once:did-finish-load'), 'function');

  browserWindow.__webContentsHandlers.get('once:did-finish-load')();
  trayEvents[0][1]();

  assert.equal(aboutCalls.length, 1);
  assert.equal(trayState.focused, 1);
});
