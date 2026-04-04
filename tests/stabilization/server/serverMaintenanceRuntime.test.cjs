const test = require('node:test');
const assert = require('node:assert/strict');

const {
  removeUploadedFile,
  createServerMaintenanceRuntime,
} = require('../../../server/src/startup/serverMaintenanceRuntime');

test('server maintenance runtime removes uploaded files using basename-safe paths', () => {
  const deleted = [];
  const filePath = removeUploadedFile('../unsafe/path/file.bin', {
    uploadsDir: '/srv/uploads',
    unlinkSyncFn: (target) => deleted.push(target),
  });

  assert.equal(filePath, '/srv/uploads/file.bin');
  assert.deepEqual(deleted, ['/srv/uploads/file.bin']);
});

test('server maintenance runtime cleans expired uploads and schedules cleanup intervals', () => {
  const deleted = [];
  const emitted = [];
  const logs = [];
  const scheduled = [];
  let deleteExpiredAssetRuns = 0;
  let deleteExpiredSessionRuns = 0;
  let deleteExpiredUnclaimedRuns = 0;
  let deleteExpiredGuildChatRuns = 0;

  const runtime = createServerMaintenanceRuntime({
    getExpiredAssetDumps: {
      all: () => [{ id: 'asset-1', file_url: 'https://guild.test/uploads/asset-1.bin' }],
    },
    deleteExpiredAssetDumps: {
      run: () => { deleteExpiredAssetRuns += 1; },
    },
    deleteExpiredSessions: {
      run: () => { deleteExpiredSessionRuns += 1; },
    },
    getExpiredUnclaimedUploadedFiles: {
      all: () => [{ stored_name: 'pending-1.bin' }],
    },
    deleteExpiredUnclaimedUploadedFiles: {
      run: () => { deleteExpiredUnclaimedRuns += 1; },
    },
    getExpiredGuildChatUploadedFiles: {
      all: () => [{ stored_name: 'guildchat-1.bin' }],
    },
    deleteExpiredGuildChatUploadedFiles: {
      run: () => { deleteExpiredGuildChatRuns += 1; },
    },
    uploadsDir: '/srv/uploads',
    io: {
      emit(event, payload) {
        emitted.push({ event, payload });
      },
    },
    unlinkSyncFn: (target) => deleted.push(target),
    logFn: (message) => logs.push(message),
  });

  assert.equal(runtime.cleanupExpiredAssetDumps(), 1);
  assert.equal(runtime.cleanupExpiredUnclaimedUploads(), 1);
  assert.equal(runtime.cleanupExpiredGuildChatUploads(), 1);
  runtime.cleanupExpiredSessions();

  const handles = runtime.schedule((handler, intervalMs) => {
    scheduled.push(intervalMs);
    return { handler, intervalMs };
  });

  assert.deepEqual(deleted, [
    '/srv/uploads/asset-1.bin',
    '/srv/uploads/pending-1.bin',
    '/srv/uploads/guildchat-1.bin',
  ]);
  assert.deepEqual(emitted, [
    {
      event: 'asset:expired',
      payload: { assetIds: ['asset-1'] },
    },
  ]);
  assert.deepEqual(logs, ['Cleaned up 1 expired asset dump(s)']);
  assert.equal(deleteExpiredAssetRuns, 1);
  assert.equal(deleteExpiredSessionRuns, 1);
  assert.equal(deleteExpiredUnclaimedRuns, 1);
  assert.equal(deleteExpiredGuildChatRuns, 1);
  assert.deepEqual(scheduled, [
    10 * 60 * 1000,
    60 * 60 * 1000,
    60 * 60 * 1000,
    60 * 60 * 1000,
  ]);
  assert.equal(typeof handles.assetDumps.handler, 'function');
  assert.equal(typeof handles.sessions.handler, 'function');
});
