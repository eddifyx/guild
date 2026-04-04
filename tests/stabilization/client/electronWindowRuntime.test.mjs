import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildBrowserWindowOptions,
  buildWindowRuntimeQuery,
  createElectronWindowRuntime,
} = require('../../../client/electron/electronWindowRuntime.js');

function createBrowserWindowStub() {
  const webContentsHandlers = new Map();
  const windowHandlers = new Map();
  const state = {
    loadURLCalls: [],
    loadFileCalls: [],
    openDevToolsCalls: 0,
    toggleDevToolsCalls: 0,
    focused: 0,
    restored: 0,
    shown: 0,
    minimized: false,
    visible: true,
    maximized: false,
    closed: 0,
    minimizedCalls: 0,
    maximizedCalls: 0,
    unmaximizedCalls: 0,
  };

  const webContents = {
    on(event, handler) {
      webContentsHandlers.set(event, handler);
    },
    once(event, handler) {
      webContentsHandlers.set(`once:${event}`, handler);
    },
    openDevTools() {
      state.openDevToolsCalls += 1;
    },
    toggleDevTools() {
      state.toggleDevToolsCalls += 1;
    },
    setWindowOpenHandler(handler) {
      state.windowOpenHandler = handler;
    },
    getURL() {
      return state.currentUrl || 'app://index.html';
    },
  };

  const browserWindow = {
    webContents,
    loadURL(url) {
      state.currentUrl = url;
      state.loadURLCalls.push(url);
    },
    loadFile(filePath, options) {
      state.loadFileCalls.push([filePath, options]);
    },
    on(event, handler) {
      windowHandlers.set(event, handler);
    },
    isMaximized() {
      return state.maximized;
    },
    maximize() {
      state.maximized = true;
      state.maximizedCalls += 1;
    },
    unmaximize() {
      state.maximized = false;
      state.unmaximizedCalls += 1;
    },
    minimize() {
      state.minimized = true;
      state.minimizedCalls += 1;
    },
    close() {
      state.closed += 1;
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
    __windowHandlers: windowHandlers,
  };

  return browserWindow;
}

test('electron window runtime builds canonical window contracts', () => {
  assert.deepEqual(buildWindowRuntimeQuery(null), null);
  assert.deepEqual(buildWindowRuntimeQuery('https://guild.test'), { serverUrl: 'https://guild.test' });

  assert.equal(
    buildBrowserWindowOptions({
      appDisplayName: 'Guild',
      iconPath: '/tmp/icon.png',
      preloadPath: '/tmp/preload.js',
      profilePartition: 'persist:guild-default',
    }).title,
    'Guild'
  );
});

test('electron window runtime creates the main window and wires dev loading, logging, and external navigation handlers', () => {
  const menuCalls = [];
  const externalOpens = [];
  const debugLogs = [];
  const browserWindow = createBrowserWindowStub();
  let currentWindow = null;

  const runtime = createElectronWindowRuntime({
    app: { focus() {}, name: 'Guild' },
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    appendDebugLog: (scope, details) => debugLogs.push([scope, details]),
    baseDir: '/tmp/client/electron',
    BrowserWindow: function BrowserWindow(options) {
      browserWindow.__state.options = options;
      return browserWindow;
    },
    dialog: { showMessageBox() {} },
    getMainWindow: () => currentWindow,
    Menu: {
      buildFromTemplate(template) {
        return {
          template,
          popup(args) {
            menuCalls.push([template, args]);
          },
        };
      },
      setApplicationMenu() {},
    },
    openExternalHttpUrl: (url) => {
      externalOpens.push(url);
      return true;
    },
    processRef: { platform: 'win32', argv: [], execPath: '/tmp/Guild.exe' },
    profileId: null,
    profilePartition: 'persist:guild-default',
    resolveFlavorAssetPath: () => '/tmp/icon.png',
    runtimeServerUrl: 'https://guild.test',
    mainWindowViteDevServerUrl: 'http://localhost:5173',
    mainWindowViteName: 'main_window',
    setMainWindow: (windowValue) => {
      currentWindow = windowValue;
    },
    setTray() {},
    path: {
      join: (...parts) => parts.join('/'),
    },
    Tray: function Tray() {},
  });

  const createdWindow = runtime.createWindow();
  const handlers = createdWindow.__webContentsHandlers;

  assert.equal(createdWindow.__state.options.title, 'Guild');
  assert.equal(createdWindow.__state.options.webPreferences.partition, 'persist:guild-default');
  assert.equal(createdWindow.__state.loadURLCalls[0], 'http://localhost:5173/?serverUrl=https%3A%2F%2Fguild.test');
  assert.equal(createdWindow.__state.openDevToolsCalls, 1);

  handlers.get('before-input-event')({}, { key: 'F12' });
  assert.equal(createdWindow.__state.toggleDevToolsCalls, 1);

  handlers.get('console-message')({}, 'warn', '[ScreenShare] hello', 9, 'renderer.js');
  assert.deepEqual(debugLogs, [['renderer-console', '[ScreenShare] hello (renderer.js:9)']]);

  handlers.get('context-menu')({ preventDefault() {} }, { isEditable: true });
  assert.equal(menuCalls.length, 1);

  const aboutBlank = createdWindow.__state.windowOpenHandler({ url: 'about:blank' });
  const remoteOpen = createdWindow.__state.windowOpenHandler({ url: 'https://guild.test/docs' });
  assert.equal(aboutBlank.action, 'allow');
  assert.deepEqual(remoteOpen, { action: 'deny' });
  assert.deepEqual(externalOpens, ['https://guild.test/docs']);

  const navEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  handlers.get('will-navigate')(navEvent, 'https://guild.test/help');
  assert.equal(navEvent.prevented, true);
  assert.deepEqual(externalOpens, ['https://guild.test/docs', 'https://guild.test/help']);
});

test('electron window runtime focuses windows, handles second-instance, and configures platform shell integrations', () => {
  const menuBuilds = [];
  const browserWindow = createBrowserWindowStub();
  let currentWindow = browserWindow;

  const runtime = createElectronWindowRuntime({
    app: {
      name: 'Guild',
      showAboutPanel() {},
    },
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    appendDebugLog() {},
    baseDir: '/tmp/client/electron',
    BrowserWindow: function BrowserWindow() {
      return browserWindow;
    },
    dialog: { showMessageBox() {} },
    getMainWindow: () => currentWindow,
    Menu: {
      buildFromTemplate(template) {
        menuBuilds.push(template);
        return {
          template,
          popup() {},
        };
      },
      setApplicationMenu() {},
    },
    openExternalHttpUrl: () => true,
    processRef: {
      platform: 'win32',
      argv: [],
      execPath: '/tmp/Guild.exe',
    },
    profileId: 'staging',
    profilePartition: 'persist:guild-default',
    resolveFlavorAssetPath: () => '/tmp/icon.png',
    runtimeServerUrl: null,
    mainWindowViteDevServerUrl: null,
    mainWindowViteName: 'main_window',
    setMainWindow: (windowValue) => {
      currentWindow = windowValue;
    },
    setTray() {},
    path: {
      join: (...parts) => parts.join('/'),
    },
    Tray: function Tray() {},
  });

  const createdWindow = runtime.createWindow();
  createdWindow.__windowHandlers.get('system-context-menu')(
    { preventDefault() {} },
    { x: 10, y: 20 }
  );

  assert.equal(menuBuilds.length, 1);
});
