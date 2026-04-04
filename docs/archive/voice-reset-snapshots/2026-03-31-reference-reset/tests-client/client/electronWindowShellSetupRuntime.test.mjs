import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronWindowShellSetupRuntime,
} = require('../../../client/electron/electronWindowShellSetupRuntime.js');

function createBrowserWindowStub() {
  const webContentsHandlers = new Map();
  const state = {
    focused: 0,
    restored: 0,
    minimized: false,
  };

  return {
    webContents: {
      once(event, handler) {
        webContentsHandlers.set(`once:${event}`, handler);
      },
    },
    isMinimized() {
      return state.minimized;
    },
    restore() {
      state.minimized = false;
      state.restored += 1;
    },
    focus() {
      state.focused += 1;
    },
    __state: state,
    __webContentsHandlers: webContentsHandlers,
  };
}

test('electron window shell setup runtime handles app menu, second-instance, and ready-shell integrations', () => {
  const aboutCalls = [];
  const trayState = {};
  const browserWindow = createBrowserWindowStub();
  browserWindow.__state.minimized = true;

  const runtime = createElectronWindowShellSetupRuntime({
    app: {
      quit() {
        trayState.quit = true;
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
      setApplicationMenu(menu) {
        trayState.applicationMenu = menu;
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
    Tray() {
      throw new Error('ready shell ownership moved to electronWindowReadyShellRuntime');
    },
  });

  runtime.installApplicationMenu();
  runtime.handleSecondInstance(['--show-about']);

  assert.equal(trayState.applicationMenu, null);
  assert.equal(browserWindow.__state.restored, 1);
  assert.equal(browserWindow.__state.focused, 1);
  assert.equal(aboutCalls.length, 1);
});
