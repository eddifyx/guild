const test = require('node:test');
const assert = require('node:assert/strict');

const { createGuildChatRuntimeFlow } = require('../../../server/src/domain/messaging/guildChatRuntimeFlow');

function createHarness(overrides = {}) {
  const deletedUploads = [];
  const unlinkedFiles = [];
  const timers = [];
  const clearedTimers = [];
  const io = {
    sockets: {
      adapter: {
        rooms: new Map(),
      },
    },
  };

  const flow = createGuildChatRuntimeFlow({
    deleteUploadedFileRecord: {
      run: (uploadId) => deletedUploads.push(uploadId),
    },
    unlinkStoredFile: (storedName) => unlinkedFiles.push(storedName),
    maxLiveMessages: 2,
    graceMs: 1000,
    setTimeoutFn: (fn, ms) => {
      const timer = { fn, ms };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      clearedTimers.push(timer);
    },
    ...overrides,
  });

  return {
    flow,
    io,
    timers,
    clearedTimers,
    deletedUploads,
    unlinkedFiles,
  };
}

test('guild chat runtime flow evicts stale attachment uploads past the live message window', () => {
  const { flow, deletedUploads, unlinkedFiles } = createHarness();

  flow.trackAttachments('guild-1', 'message-1', [{ uploaded_file_id: 'upload-1', _storedName: 'stored-1.bin' }]);
  flow.trackAttachments('guild-1', 'message-2', [{ uploaded_file_id: 'upload-2', _storedName: 'stored-2.bin' }]);
  flow.trackAttachments('guild-1', 'message-3', [{ uploaded_file_id: 'upload-3', _storedName: 'stored-3.bin' }]);

  assert.deepEqual(deletedUploads, ['upload-1']);
  assert.deepEqual(unlinkedFiles, ['stored-1.bin']);
});

test('guild chat runtime flow cancels existing cleanup timers before scheduling new ones', () => {
  const { flow, io, timers, clearedTimers } = createHarness();

  flow.scheduleCleanup(io, 'guild-1', (guildId) => `guildchat:${guildId}`);
  flow.scheduleCleanup(io, 'guild-1', (guildId) => `guildchat:${guildId}`);

  assert.equal(timers.length, 2);
  assert.deepEqual(clearedTimers, [timers[0]]);
});

test('guild chat runtime flow only cleans up detached guild rooms after the grace timer fires', () => {
  const { flow, io, timers, deletedUploads, unlinkedFiles } = createHarness();
  flow.trackAttachments('guild-1', 'message-1', [{ uploaded_file_id: 'upload-1', _storedName: 'stored-1.bin' }]);

  io.sockets.adapter.rooms.set('guildchat:guild-1', { size: 1 });
  flow.scheduleCleanup(io, 'guild-1', (guildId) => `guildchat:${guildId}`);
  timers[0].fn();

  assert.deepEqual(deletedUploads, []);
  assert.deepEqual(unlinkedFiles, []);

  io.sockets.adapter.rooms.delete('guildchat:guild-1');
  flow.scheduleCleanup(io, 'guild-1', (guildId) => `guildchat:${guildId}`);
  timers[1].fn();

  assert.deepEqual(deletedUploads, ['upload-1']);
  assert.deepEqual(unlinkedFiles, ['stored-1.bin']);
});
