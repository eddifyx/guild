import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerPersistedStateIpcHandlers,
} = require('../../../client/electron/electronPersistedStateIpcRuntime.js');

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

test('persisted-state IPC runtime registers trusted message-cache, room-snapshot, auth-state, and signer-state handlers', async () => {
  const trustedScopes = [];
  const warnings = [];
  const calls = [];
  const ipcMain = createIpcMainStub();

  registerPersistedStateIpcHandlers({
    clearAuthBackup() {
      calls.push(['auth-clear']);
      return true;
    },
    clearSignerState() {
      calls.push(['signer-clear']);
      return true;
    },
    deleteMessageCacheEntry(userId, messageId) {
      calls.push(['cache-delete', userId, messageId]);
      return true;
    },
    getMessageCacheEntry(userId, messageId) {
      calls.push(['cache-get', userId, messageId]);
      return { messageId };
    },
    getManyMessageCacheEntries(userId, messageIds) {
      calls.push(['cache-get-many', userId, messageIds]);
      return messageIds.map((messageId) => ({ messageId }));
    },
    getRoomSnapshotEntry(userId, roomId) {
      calls.push(['room-get', userId, roomId]);
      return { roomId };
    },
    ipcMain,
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
    readAuthBackup() {
      calls.push(['auth-read']);
      return { token: 'abc' };
    },
    readSignerState() {
      calls.push(['signer-read']);
      return { mode: 'nsec', secretKey: 'base64' };
    },
    requireTrustedSender(_event, scope) {
      trustedScopes.push(scope);
    },
    setMessageCacheEntry(userId, messageId, entry) {
      calls.push(['cache-set', userId, messageId, entry]);
      return true;
    },
    setRoomSnapshotEntry(userId, roomId, snapshot) {
      calls.push(['room-set', userId, roomId, snapshot]);
      return true;
    },
    writeAuthBackup(authData) {
      calls.push(['auth-write', authData]);
      return true;
    },
    writeSignerState(signerState) {
      calls.push(['signer-write', signerState]);
      return true;
    },
  });

  assert.deepEqual(
    ipcMain.__handles.get('message-cache:get')({}, 'user-1', 'msg-1'),
    { messageId: 'msg-1' }
  );
  assert.deepEqual(
    ipcMain.__handles.get('message-cache:get-many')({}, 'user-1', ['msg-1', 'msg-2']),
    [{ messageId: 'msg-1' }, { messageId: 'msg-2' }]
  );
  assert.equal(
    ipcMain.__handles.get('message-cache:set')({}, 'user-1', 'msg-1', { body: 'hi' }),
    true
  );
  assert.equal(ipcMain.__handles.get('message-cache:delete')({}, 'user-1', 'msg-1'), true);
  assert.deepEqual(
    ipcMain.__handles.get('room-snapshot:get')({}, 'user-1', 'room-1'),
    { roomId: 'room-1' }
  );
  assert.equal(
    ipcMain.__handles.get('room-snapshot:set')({}, 'user-1', 'room-1', { messages: [] }),
    true
  );

  const authEvent = {};
  ipcMain.__handlers.get('auth-state:get-sync')(authEvent);
  assert.deepEqual(authEvent.returnValue, { token: 'abc' });
  assert.equal(ipcMain.__handles.get('auth-state:set')({}, { token: 'abc' }), true);
  assert.equal(ipcMain.__handles.get('auth-state:clear')({}), true);
  assert.deepEqual(
    await ipcMain.__handles.get('signer-state:get')({}),
    { mode: 'nsec', secretKey: 'base64' }
  );
  assert.equal(
    await ipcMain.__handles.get('signer-state:set')({}, { mode: 'nsec', secretKey: 'base64' }),
    true
  );
  assert.equal(await ipcMain.__handles.get('signer-state:clear')({}), true);

  assert.equal(warnings.length, 0);
  assert.deepEqual(trustedScopes, [
    'message-cache:get',
    'message-cache:get-many',
    'message-cache:set',
    'message-cache:delete',
    'room-snapshot:get',
    'room-snapshot:set',
    'auth-state:get-sync',
    'auth-state:set',
    'auth-state:clear',
    'signer-state:get',
    'signer-state:set',
    'signer-state:clear',
  ]);
});

test('persisted-state IPC runtime falls back to single-entry cache lookup and blocks untrusted auth sync reads', () => {
  const warnings = [];
  const trustedScopes = [];
  const ipcMain = createIpcMainStub();

  registerPersistedStateIpcHandlers({
    clearAuthBackup() {
      return true;
    },
    clearSignerState() {
      return true;
    },
    deleteMessageCacheEntry() {
      return true;
    },
    getMessageCacheEntry(_userId, messageId) {
      return { messageId };
    },
    ipcMain,
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
    readAuthBackup() {
      return { token: 'abc' };
    },
    readSignerState() {
      return { mode: 'nsec', secretKey: 'base64' };
    },
    requireTrustedSender(_event, scope) {
      trustedScopes.push(scope);
      if (scope === 'auth-state:get-sync') {
        throw new Error('blocked');
      }
    },
    setMessageCacheEntry() {
      return true;
    },
    writeAuthBackup() {
      return true;
    },
    writeSignerState() {
      return true;
    },
  });

  assert.deepEqual(
    ipcMain.__handles.get('message-cache:get-many')({}, 'user-1', ['msg-1', 'msg-2']),
    [{ messageId: 'msg-1' }, { messageId: 'msg-2' }]
  );

  const authEvent = {};
  ipcMain.__handlers.get('auth-state:get-sync')(authEvent);
  assert.equal(authEvent.returnValue, null);
  assert.equal(warnings.length, 1);
  assert.ok(trustedScopes.includes('auth-state:get-sync'));
  assert.ok(ipcMain.__handles.has('signer-state:get'));
  assert.ok(ipcMain.__handles.has('signer-state:set'));
  assert.ok(ipcMain.__handles.has('signer-state:clear'));
  assert.equal(ipcMain.__handles.has('room-snapshot:get'), false);
  assert.equal(ipcMain.__handles.has('room-snapshot:set'), false);
});
