import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerCaptureIpcHandlers,
} = require('../../../client/electron/electronCaptureIpcRuntime.js');

function createIpcMainStub() {
  const handles = new Map();
  return {
    handle(channel, fn) {
      handles.set(channel, fn);
    },
    __handles: handles,
  };
}

test('capture IPC runtime registers Apple voice and desktop-source handlers through canonical deps', async () => {
  const calls = [];
  const trustedScopes = [];
  const ipcMain = createIpcMainStub();

  registerCaptureIpcHandlers({
    appendDebugLog(scope, details) {
      calls.push(['debug', scope, details]);
    },
    desktopCapturer: { kind: 'desktopCapturer' },
    getDesktopSourceCache() {
      calls.push(['get-cache']);
      return { sources: [] };
    },
    getDesktopSources(args) {
      calls.push(['get-sources', args]);
      return [{ id: 'screen:1' }];
    },
    getDesktopThumbnails(args) {
      calls.push(['get-thumbnails', args]);
      return ['thumb'];
    },
    getDesktopWindows(args) {
      calls.push(['get-windows', args]);
      return ['window'];
    },
    getScreenCaptureAccessStatus(args) {
      calls.push(['capture-status', args]);
      return 'granted';
    },
    ipcMain,
    isAppleVoiceCaptureSupported() {
      calls.push(['apple-supported']);
      return true;
    },
    openExternal(url) {
      calls.push(['open-external', url]);
      return true;
    },
    openScreenCaptureSettings(args) {
      calls.push(['open-settings', args]);
      return true;
    },
    platform: 'darwin',
    prefetchDesktopSources(args) {
      calls.push(['prefetch', args]);
      return ['prefetched'];
    },
    primeAppleVoiceCapture() {
      calls.push(['apple-prime']);
      return 'primed';
    },
    requireTrustedSender(_event, scope) {
      trustedScopes.push(scope);
    },
    selectDesktopSource(sourceId, args) {
      calls.push(['select-source', sourceId, args]);
      return true;
    },
    setDesktopSourceCache(value) {
      calls.push(['set-cache', value]);
    },
    setPendingSourceId(value) {
      calls.push(['set-pending', value]);
    },
    startAppleVoiceCaptureSession(ownerId) {
      calls.push(['apple-start', ownerId]);
      return `started:${ownerId}`;
    },
    stopAppleVoiceCaptureSession(ownerId) {
      calls.push(['apple-stop', ownerId]);
      return `stopped:${ownerId}`;
    },
    systemPreferences: { kind: 'prefs' },
  });

  assert.equal(await ipcMain.__handles.get('apple-voice-capture-supported')(), true);
  assert.equal(await ipcMain.__handles.get('apple-voice-capture-prime')(), 'primed');
  assert.equal(await ipcMain.__handles.get('apple-voice-capture-start')(null, 'owner-1'), 'started:owner-1');
  assert.equal(await ipcMain.__handles.get('apple-voice-capture-stop')(null, 'owner-1'), 'stopped:owner-1');
  assert.deepEqual(await ipcMain.__handles.get('prefetch-desktop-sources')(), ['prefetched']);
  assert.deepEqual(await ipcMain.__handles.get('get-desktop-sources')(), [{ id: 'screen:1' }]);
  assert.deepEqual(await ipcMain.__handles.get('get-desktop-windows')(), ['window']);
  assert.deepEqual(await ipcMain.__handles.get('get-desktop-thumbnails')(), ['thumb']);
  assert.equal(await ipcMain.__handles.get('select-desktop-source')(null, 'screen:1'), undefined);
  assert.equal(await ipcMain.__handles.get('get-screen-capture-access-status')(), 'granted');
  assert.equal(await ipcMain.__handles.get('open-screen-capture-settings')({}, 'unused'), true);

  assert.deepEqual(trustedScopes, ['open-screen-capture-settings']);
  assert.ok(calls.some(([name]) => name === 'prefetch'));
  assert.ok(calls.some(([name]) => name === 'apple-start'));
});

test('capture IPC runtime only enforces trust gating for screen-capture settings', async () => {
  const ipcMain = createIpcMainStub();

  registerCaptureIpcHandlers({
    appendDebugLog() {},
    desktopCapturer: {},
    getDesktopSourceCache() {
      return null;
    },
    getDesktopSources() {
      return [];
    },
    getDesktopThumbnails() {
      return [];
    },
    getDesktopWindows() {
      return [];
    },
    getScreenCaptureAccessStatus() {
      return 'denied';
    },
    ipcMain,
    isAppleVoiceCaptureSupported() {
      return false;
    },
    openExternal() {},
    openScreenCaptureSettings() {
      return false;
    },
    platform: 'linux',
    prefetchDesktopSources() {
      return [];
    },
    primeAppleVoiceCapture() {
      return false;
    },
    requireTrustedSender(_event, scope) {
      throw new Error(`blocked:${scope}`);
    },
    selectDesktopSource() {
      return true;
    },
    setDesktopSourceCache() {},
    setPendingSourceId() {},
    startAppleVoiceCaptureSession() {
      return null;
    },
    stopAppleVoiceCaptureSession() {
      return null;
    },
    systemPreferences: {},
  });

  assert.equal(await ipcMain.__handles.get('apple-voice-capture-supported')(), false);
  assert.deepEqual(await ipcMain.__handles.get('prefetch-desktop-sources')(), []);
  await assert.rejects(
    () => ipcMain.__handles.get('open-screen-capture-settings')({}, 'unused'),
    /blocked:open-screen-capture-settings/
  );
});
