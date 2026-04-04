const test = require('node:test');
const assert = require('node:assert/strict');

const { createMessagesReadRepository } = require('../../../server/src/repositories/messagesReadRepository');

test('messages read repository blocks room history when the user is not a room member', () => {
  const repository = createMessagesReadRepository({
    db: {
      prepare() {
        throw new Error('room query should not execute without membership');
      },
    },
    getRoomMembership: {
      get() {
        return null;
      },
    },
  });

  assert.deepEqual(repository.getRoomMessages('room-1', 'user-1'), []);
});

test('messages read repository returns full board history for current members and preserves ascending order', () => {
  const preparedCalls = [];
  const repository = createMessagesReadRepository({
    db: {
      prepare(sql) {
        preparedCalls.push(sql);
        return {
          all(...args) {
            preparedCalls.push(args);
            return [{ id: 'newer' }, { id: 'older' }];
          },
        };
      },
    },
    getRoomMembership: {
      get() {
        return { joined_at: '2026-03-25 10:00:00' };
      },
    },
  });

  assert.deepEqual(
    repository.getRoomMessages('room-1', 'user-1', '2026-03-25 12:00:00', 20),
    [{ id: 'older' }, { id: 'newer' }]
  );
  assert.deepEqual(preparedCalls[1], ['room-1', '2026-03-25 12:00:00', 20]);
  assert.doesNotMatch(preparedCalls[0], /joined_at|m\.created_at >= \?/);
});

test('messages read repository groups attachments by message id and short-circuits empty input', () => {
  const repository = createMessagesReadRepository({
    db: {
      prepare() {
        return {
          all() {
            return [
              { id: 'att-1', message_id: 'message-1' },
              { id: 'att-2', message_id: 'message-1' },
              { id: 'att-3', message_id: 'message-2' },
            ];
          },
        };
      },
    },
    getRoomMembership: {
      get() {
        return { joined_at: '2026-03-25 10:00:00' };
      },
    },
  });

  assert.deepEqual(repository.getAttachmentsForMessages([]), {});
  assert.deepEqual(repository.getAttachmentsForMessages(['message-1', 'message-2']), {
    'message-1': [
      { id: 'att-1', message_id: 'message-1' },
      { id: 'att-2', message_id: 'message-1' },
    ],
    'message-2': [{ id: 'att-3', message_id: 'message-2' }],
  });
});

test('messages read repository returns raw dm conversation rows in created-at order', () => {
  const repository = createMessagesReadRepository({
    db: {
      prepare() {
        return {
          all(...args) {
            assert.deepEqual(args, ['user-1', 'user-1', 'user-1', 'user-1']);
            return [{ other_user_id: 'user-2' }];
          },
        };
      },
    },
    getRoomMembership: {
      get() {
        return { joined_at: '2026-03-25 10:00:00' };
      },
    },
  });

  assert.deepEqual(repository.listRawDMConversations('user-1'), [{ other_user_id: 'user-2' }]);
});
