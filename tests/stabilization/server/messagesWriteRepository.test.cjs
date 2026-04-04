const test = require('node:test');
const assert = require('node:assert/strict');

const { createMessagesWriteRepository } = require('../../../server/src/repositories/messagesWriteRepository');

test('messages write repository exposes canonical message and attachment persistence operations', () => {
  const calls = [];
  const repository = createMessagesWriteRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'message-1', sender_id: 'user-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'attachment-1' }];
          },
        };
      },
    },
  });

  repository.insertMessage.run('message-1', 'hello', 'user-1', 'room-1', null);
  repository.insertAttachment.run('attachment-1', 'message-1', 'upload-1', '/files/1', 'a.txt', 'text/plain', 12);
  repository.getMessageById.get('message-1');
  repository.getMessageAttachments.all('message-1');
  repository.updateMessageContent.run('updated', 'message-1', 'user-1');
  repository.deleteMessageAttachments.run('message-1');
  repository.deleteMessage.run('message-1', 'user-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['message-1', 'hello', 'user-1', 'room-1', null],
    ['attachment-1', 'message-1', 'upload-1', '/files/1', 'a.txt', 'text/plain', 12],
    ['message-1'],
    ['message-1'],
    ['updated', 'message-1', 'user-1'],
    ['message-1'],
    ['message-1', 'user-1'],
  ]);
});

test('messages write repository exposes direct-message conversation persistence operations', () => {
  const calls = [];
  const repository = createMessagesWriteRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get() {
            return null;
          },
          all() {
            return [];
          },
        };
      },
    },
  });

  repository.ensureDMConversation.run('user-1', 'user-2');
  repository.deleteDMConversation.run('user-1', 'user-2', 'user-1', 'user-2');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['user-1', 'user-2'],
    ['user-1', 'user-2', 'user-1', 'user-2'],
  ]);
});
