import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSystemIpcHandlers,
} = require('../../../client/electron/electronSystemIpcRuntime.js');

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

function createNotificationStub() {
  class NotificationStub {
    static instances = [];

    static isSupported() {
      return true;
    }

    constructor(options) {
      this.options = options;
      this.handlers = new Map();
      this.shown = false;
      NotificationStub.instances.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    show() {
      this.shown = true;
    }
  }

  return NotificationStub;
}

test('system IPC runtime registers perf, external, notifications, and update handlers', async () => {
  const ipcMain = createIpcMainStub();
  const perfSamples = [];
  const focusCalls = [];
  const sentActions = [];
  const updateCalls = [];
  const trustedScopes = [];
  const NotificationStub = createNotificationStub();

  registerSystemIpcHandlers({
    Notification: NotificationStub,
    appendDebugLog(scope, details) {
      updateCalls.push(['debug', scope, details]);
    },
    focusMainWindow() {
      focusCalls.push('focus');
    },
    getMainWindow() {
      return {
        webContents: {
          send(channel, payload) {
            sentActions.push([channel, payload]);
          },
        },
      };
    },
    getPerfSamples() {
      return perfSamples.slice();
    },
    ipcMain,
    openExternalHttpUrl(url) {
      updateCalls.push(['external', url]);
      return true;
    },
    readDebugLogTail({ scope, limit }) {
      updateCalls.push(['debug-tail', scope, limit]);
      return ['tail-line'];
    },
    recordPerfSample(sample) {
      perfSamples.push(sample);
    },
    requireTrustedSender(_event, scope) {
      trustedScopes.push(scope);
    },
    resolveFlavorAssetPath(assetStem, extension) {
      return `/tmp/${assetStem}.${extension}`;
    },
    updateRuntime: {
      applyUpdate(payload) {
        updateCalls.push(['apply', payload]);
        return true;
      },
      downloadUpdate(source) {
        updateCalls.push(['download', source]);
        return true;
      },
    },
  });

  ipcMain.__handlers.get('perf:sample')(null, { fps: 60 });
  assert.deepEqual(ipcMain.__handles.get('perf:get-samples')(), [{ fps: 60 }]);
  assert.equal(ipcMain.__handles.get('open-external')({}, 'https://guild.test'), true);
  assert.equal(ipcMain.__handles.get('debug-log')(null, 'scope', 'details'), true);
  assert.deepEqual(await ipcMain.__handles.get('debug-log:get-tail')({}, 'message-decrypt', 12), ['tail-line']);
  assert.equal(
    await ipcMain.__handles.get('system-notification:show')({}, {
      title: 'Guild',
      body: 'Ready',
      route: { to: '/rooms/1' },
    }),
    true
  );
  const notification = NotificationStub.instances[0];
  assert.equal(notification.shown, true);
  notification.handlers.get('click')();
  assert.deepEqual(focusCalls, ['focus']);
  assert.deepEqual(sentActions, [['system-notification:action', { to: '/rooms/1' }]]);
  assert.equal(await ipcMain.__handles.get('download-update')({}, 'https://updates.guild.test'), true);
  assert.equal(await ipcMain.__handles.get('apply-update')({}, { zipPath: '/tmp/a.zip', tempDir: '/tmp/a' }), true);
  assert.deepEqual(trustedScopes, [
    'open-external',
    'debug-log:get-tail',
    'system-notification:show',
    'download-update',
    'apply-update',
  ]);
});

test('system IPC runtime rejects notification display without support or title', async () => {
  const ipcMain = createIpcMainStub();
  class UnsupportedNotification {
    static isSupported() {
      return false;
    }
  }

  registerSystemIpcHandlers({
    Notification: UnsupportedNotification,
    appendDebugLog() {},
    focusMainWindow() {},
    getMainWindow() {
      return null;
    },
    getPerfSamples() {
      return [];
    },
    ipcMain,
    openExternalHttpUrl() {
      return false;
    },
    readDebugLogTail() {
      return [];
    },
    recordPerfSample() {},
    requireTrustedSender() {},
    resolveFlavorAssetPath() {
      return '/tmp/icon.png';
    },
    updateRuntime: {
      applyUpdate() {
        return false;
      },
      downloadUpdate() {
        return false;
      },
    },
  });

  assert.equal(await ipcMain.__handles.get('system-notification:show')({}, { title: 'Guild' }), false);
});
