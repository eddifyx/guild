import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronWindowShellRuntime,
} = require('../../../client/electron/electronWindowShellRuntime.js');

function createBrowserWindowStub() {
  const webContentsHandlers = new Map();
  const state = {
    focused: 0,
    restored: 0,
    shown: 0,
    minimized: false,
    visible: true,
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
    isVisible() {
      return state.visible;
    },
    show() {
      state.visible = true;
      state.shown += 1;
    },
    focus() {
      state.focused += 1;
    },
    __state: state,
    __webContentsHandlers: webContentsHandlers,
  };
}

test('electron window shell runtime focuses windows, handles second-instance, and configures platform shell integrations', () => {
  const aboutCalls = [];
  const userTasks = [];
  const trayEvents = [];
  const trayState = {};
  const browserWindow = createBrowserWindowStub();
  browserWindow.__state.visible = false;
  browserWindow.__state.minimized = true;
  let focused = 0;

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

  const runtime = createElectronWindowShellRuntime({
    app: {
      focus() {
        focused += 1;
      },
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
    dialog: {
      showMessageBox(windowValue, options) {
        aboutCalls.push([windowValue, options]);
      },
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
    Tray,
  });

  runtime.focusMainWindow();
  assert.equal(browserWindow.__state.restored, 1);
  assert.equal(browserWindow.__state.shown, 1);
  assert.equal(browserWindow.__state.focused, 1);
  assert.equal(focused, 0);

  runtime.showAboutDialog();
  assert.equal(aboutCalls.length, 1);
  assert.equal(aboutCalls[0][1].title, 'About Guild');

  runtime.handleSecondInstance(['--show-about']);
  assert.equal(aboutCalls.length, 2);

  runtime.installApplicationMenu();
  runtime.setupReadyShell();
  assert.equal(userTasks.length, 1);
  assert.equal(userTasks[0][0].arguments, '--profile=staging --show-about');
  assert.equal(trayState.tooltip, 'Guild v1.2.3');
  assert.equal(typeof trayEvents[0][1], 'function');
});
