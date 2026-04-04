import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronWindowContentRuntime,
} = require('../../../client/electron/electronWindowContentRuntime.js');

function createBrowserWindowStub() {
  const webContentsHandlers = new Map();
  const windowHandlers = new Map();
  const state = {
    loadURLCalls: [],
    loadFileCalls: [],
    openDevToolsCalls: 0,
    toggleDevToolsCalls: 0,
    maximized: false,
  };

  const webContents = {
    on(event, handler) {
      webContentsHandlers.set(event, handler);
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
    },
    unmaximize() {
      state.maximized = false;
    },
    minimize() {},
    close() {},
    __state: state,
    __webContentsHandlers: webContentsHandlers,
    __windowHandlers: windowHandlers,
  };

  return browserWindow;
}

test('electron window content runtime loads content and wires navigation, logging, and context menu handlers', () => {
  const menuCalls = [];
  const externalOpens = [];
  const debugLogs = [];
  const warnings = [];
  const browserWindow = createBrowserWindowStub();

  const runtime = createElectronWindowContentRuntime({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    appendDebugLog: (scope, details) => debugLogs.push([scope, details]),
    baseDir: '/tmp/client/electron',
    mainWindowViteDevServerUrl: 'http://localhost:5173',
    mainWindowViteName: 'main_window',
    Menu: {
      buildFromTemplate(template) {
        return {
          template,
          popup(args) {
            menuCalls.push([template, args]);
          },
        };
      },
    },
    openExternalHttpUrl: (url) => {
      externalOpens.push(url);
      return true;
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    runtimeServerUrl: 'https://guild.test',
    consoleRef: {
      warn: (...args) => warnings.push(args.join(' ')),
    },
    shellRuntime: {
      showAboutDialog() {},
    },
  });

  runtime.bindWindowContent(browserWindow);
  const handlers = browserWindow.__webContentsHandlers;

  assert.equal(browserWindow.__state.loadURLCalls[0], 'http://localhost:5173/?serverUrl=https%3A%2F%2Fguild.test');
  assert.equal(browserWindow.__state.openDevToolsCalls, 1);

  handlers.get('before-input-event')({}, { key: 'F12' });
  assert.equal(browserWindow.__state.toggleDevToolsCalls, 1);

  handlers.get('console-message')({}, 'warn', '[ScreenShare] hello', 9, 'renderer.js');
  assert.deepEqual(debugLogs, [['renderer-console', '[ScreenShare] hello (renderer.js:9)']]);
  assert.match(warnings[0], /\[Renderer:warn\] \[ScreenShare\] hello \(renderer\.js:9\)/);

  handlers.get('context-menu')({ preventDefault() {} }, { isEditable: true });
  assert.equal(menuCalls.length, 1);

  const aboutBlank = browserWindow.__state.windowOpenHandler({ url: 'about:blank' });
  const remoteOpen = browserWindow.__state.windowOpenHandler({ url: 'https://guild.test/docs' });
  assert.equal(aboutBlank.action, 'allow');
  assert.deepEqual(remoteOpen, { action: 'deny' });
  assert.deepEqual(externalOpens, ['https://guild.test/docs']);

  const navEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  handlers.get('will-navigate')(navEvent, 'https://guild.test/help');
  assert.equal(navEvent.prevented, true);
  assert.deepEqual(externalOpens, ['https://guild.test/docs', 'https://guild.test/help']);
});

test('electron window content runtime wires the system context menu through the shell runtime', () => {
  const menuCalls = [];
  const browserWindow = createBrowserWindowStub();
  let aboutShown = 0;

  const runtime = createElectronWindowContentRuntime({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    appendDebugLog() {},
    baseDir: '/tmp/client/electron',
    enableNavigationGuards: false,
    mainWindowViteDevServerUrl: null,
    mainWindowViteName: 'main_window',
    Menu: {
      buildFromTemplate(template) {
        return {
          template,
          popup(args) {
            menuCalls.push([template, args]);
          },
        };
      },
    },
    openExternalHttpUrl: () => true,
    path: {
      join: (...parts) => parts.join('/'),
    },
    runtimeServerUrl: null,
    shellRuntime: {
      showAboutDialog() {
        aboutShown += 1;
      },
    },
  });

  runtime.bindWindowContent(browserWindow);
  browserWindow.__windowHandlers.get('system-context-menu')(
    { preventDefault() {} },
    { x: 10, y: 20 }
  );

  assert.equal(menuCalls.length, 1);
  const template = menuCalls[0][0];
  const aboutItem = template.find((entry) => entry.label === 'About Guild v1.2.3');
  aboutItem.click();
  assert.equal(aboutShown, 1);
});
