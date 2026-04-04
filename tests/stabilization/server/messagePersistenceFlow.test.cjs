const test = require('node:test');
const assert = require('node:assert/strict');

const { createMessagePersistenceFlow } = require('../../../server/src/domain/messaging/messagePersistenceFlow');

function createHarness() {
  const insertCalls = [];
  const encryptedInsertCalls = [];
  const conversationEnsures = [];
  const deletedAttachmentRows = [];
  const deletedUploads = [];
  const deletedMessages = [];
  const claimCalls = [];

  const flow = createMessagePersistenceFlow({
    db: {
      transaction: (fn) => fn,
    },
    userId: 'user-1',
    insertMessage: {
      run: (...args) => insertCalls.push(args),
    },
    insertEncryptedMessage: {
      run: (...args) => encryptedInsertCalls.push(args),
    },
    ensureDMConversation: {
      run: (...args) => conversationEnsures.push(args),
    },
    deleteMessageAttachments: {
      run: (...args) => deletedAttachmentRows.push(args),
    },
    deleteUploadedFileRecord: {
      run: (...args) => deletedUploads.push(args),
    },
    deleteMessage: {
      run: (...args) => {
        deletedMessages.push(args);
        return { changes: 1 };
      },
    },
    claimUploadedAttachments: (...args) => {
      claimCalls.push(args);
      return [{ id: 'attachment-1' }];
    },
  });

  return {
    flow,
    insertCalls,
    encryptedInsertCalls,
    conversationEnsures,
    deletedAttachmentRows,
    deletedUploads,
    deletedMessages,
    claimCalls,
  };
}

test('message persistence flow stores room messages and claims their attachments', () => {
  const { flow, insertCalls, claimCalls } = createHarness();

  const attachments = flow.persistRoomMessage({
    msgId: 'message-1',
    roomId: 'room-1',
    content: 'hello room',
    encrypted: false,
    attachmentRefs: [{ fileId: 'upload-1' }],
  });

  assert.deepEqual(insertCalls, [['message-1', 'hello room', 'user-1', 'room-1', null]]);
  assert.deepEqual(claimCalls, [[
    'message-1',
    [{ fileId: 'upload-1' }],
    { type: 'room', roomId: 'room-1' },
  ]]);
  assert.deepEqual(attachments, [{ id: 'attachment-1' }]);
});

test('message persistence flow stores encrypted direct messages and ensures the dm conversation', () => {
  const { flow, encryptedInsertCalls, conversationEnsures, claimCalls } = createHarness();

  flow.persistDirectMessage({
    msgId: 'message-2',
    toUserId: 'user-2',
    content: 'sealed',
    encrypted: true,
    attachmentRefs: [],
  });

  assert.deepEqual(encryptedInsertCalls, [['message-2', 'sealed', 'user-1', null, 'user-2', 1]]);
  assert.deepEqual(conversationEnsures, [['user-1', 'user-2']]);
  assert.deepEqual(claimCalls, [[
    'message-2',
    [],
    { type: 'dm', dmUserA: 'user-1', dmUserB: 'user-2' },
  ]]);
});

test('message persistence flow deletes attachment rows, upload rows, and the message record together', () => {
  const { flow, deletedAttachmentRows, deletedUploads, deletedMessages } = createHarness();

  const result = flow.deleteMessageWithUploads({
    messageId: 'message-3',
    senderId: 'user-1',
    uploadedFileIds: ['upload-1', 'upload-2'],
  });

  assert.deepEqual(deletedAttachmentRows, [['message-3']]);
  assert.deepEqual(deletedUploads, [['upload-1'], ['upload-2']]);
  assert.deepEqual(deletedMessages, [['message-3', 'user-1']]);
  assert.deepEqual(result, { changes: 1 });
});
