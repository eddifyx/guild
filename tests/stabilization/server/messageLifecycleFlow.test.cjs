const test = require('node:test');
const assert = require('node:assert/strict');

const { createMessageLifecycleFlow } = require('../../../server/src/domain/messaging/messageLifecycleFlow');

function createHarness(overrides = {}) {
  const broadcasts = [];
  const deletedUploads = [];
  const deletedConversations = [];
  const unlinkCalls = [];
  const updateCalls = [];
  let messageState = {
    'message-1': {
      id: 'message-1',
      sender_id: 'user-1',
      room_id: 'room-1',
      dm_partner_id: null,
      encrypted: 0,
      content: 'before',
      edited_at: null,
    },
    'message-2': {
      id: 'message-2',
      sender_id: 'user-1',
      room_id: null,
      dm_partner_id: 'user-2',
      encrypted: 0,
      content: 'before dm',
      edited_at: null,
    },
  };

  const io = {
    to(room) {
      return {
        emit(event, payload) {
          broadcasts.push([room, event, payload]);
        },
      };
    },
  };

  const flow = createMessageLifecycleFlow({
    io,
    userId: 'user-1',
    maxContentLength: 1024,
    getMessageById: {
      get: (messageId) => messageState[messageId] || null,
    },
    updateMessageContent: {
      run: (content, messageId) => {
        updateCalls.push([content, messageId]);
        if (!messageState[messageId]) return { changes: 0 };
        messageState[messageId] = {
          ...messageState[messageId],
          content,
          edited_at: '2026-03-24 20:00:00',
        };
        return { changes: 1 };
      },
    },
    getMessageAttachments: {
      all: () => [{ uploaded_file_id: 'upload-1' }, { file_url: '/api/files/legacy-file.bin' }],
    },
    getUploadedFilesByMessageId: {
      all: () => [{ id: 'upload-2', stored_name: 'stored-file.bin' }],
    },
    deleteMessageWithUploads: (payload) => deletedUploads.push(payload),
    deleteDMConversation: {
      run: (...args) => deletedConversations.push(args),
    },
    buildUploadFilePath: (rawPath) => `/abs/${rawPath.split('/').pop()}`,
    unlinkFile: (filePath) => unlinkCalls.push(filePath),
    ...overrides,
  });

  return {
    flow,
    broadcasts,
    deletedUploads,
    deletedConversations,
    unlinkCalls,
    updateCalls,
    setMessageState(nextState) {
      messageState = nextState;
    },
  };
}

test('message lifecycle flow edits room messages and emits edited payloads', () => {
  const { flow, broadcasts, updateCalls } = createHarness();
  const replies = [];

  flow.handleEdit({ messageId: 'message-1', content: 'after' }, (payload) => replies.push(payload));

  assert.deepEqual(updateCalls, [['after', 'message-1']]);
  assert.deepEqual(broadcasts, [[
    'room:room-1',
    'message:edited',
    { messageId: 'message-1', content: 'after', edited_at: '2026-03-24 20:00:00' },
  ]]);
  assert.deepEqual(replies, [{ ok: true }]);
});

test('message lifecycle flow deletes dm messages, unlinks files, and emits to both participants', () => {
  const { flow, broadcasts, deletedUploads, unlinkCalls } = createHarness();
  const replies = [];

  flow.handleDelete({ messageId: 'message-2' }, (payload) => replies.push(payload));

  assert.deepEqual(deletedUploads, [{
    messageId: 'message-2',
    senderId: 'user-1',
    uploadedFileIds: ['upload-1', 'upload-2'],
  }]);
  assert.deepEqual(unlinkCalls.sort(), ['/abs/legacy-file.bin', '/abs/stored-file.bin']);
  assert.deepEqual(broadcasts, [
    ['user:user-2', 'message:deleted', { messageId: 'message-2' }],
    ['user:user-1', 'message:deleted', { messageId: 'message-2' }],
  ]);
  assert.deepEqual(replies, [{ ok: true }]);
});

test('message lifecycle flow rejects unauthorized deletes and deletes conversations canonically', () => {
  const { flow, deletedConversations, setMessageState } = createHarness();
  setMessageState({
    'message-3': {
      id: 'message-3',
      sender_id: 'user-2',
      room_id: null,
      dm_partner_id: 'user-1',
      encrypted: 0,
    },
  });

  const replies = [];
  flow.handleDelete({ messageId: 'message-3' }, (payload) => replies.push(payload));
  flow.handleDeleteConversation({ otherUserId: 'user-2' }, (payload) => replies.push(payload));

  assert.deepEqual(replies, [
    { ok: false, error: 'Delete not permitted' },
    { ok: true },
  ]);
  assert.deepEqual(deletedConversations, [['user-1', 'user-2', 'user-1', 'user-2']]);
});
