const test = require('node:test');
const assert = require('node:assert/strict');

const { createSocialRepository } = require('../../../server/src/repositories/socialRepository');

test('social repository reads contacts through the canonical user-scoped query', () => {
  const repository = createSocialRepository({
    db: {
      prepare(sql) {
        return {
          all(...args) {
            assert.match(sql, /FROM contacts/);
            assert.deepEqual(args, ['user-1']);
            return [{ contact_npub: 'npub1contact' }];
          },
          run() {
            return { changes: 1 };
          },
          get() {
            return null;
          },
        };
      },
    },
  });

  assert.deepEqual(repository.getContactsByUser.all('user-1'), [{ contact_npub: 'npub1contact' }]);
});

test('social repository keeps friend request persistence operations stable', () => {
  const calls = [];
  const repository = createSocialRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'request-1', from_user_id: 'user-1', to_user_id: 'user-2' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'request-1' }];
          },
        };
      },
    },
  });

  repository.createFriendRequest.run('request-1', 'user-1', 'user-2');
  repository.getPendingRequestsForUser.all('user-2');
  repository.getFriendRequest.get('request-1');
  repository.acceptFriendRequest.run('request-1');
  repository.deleteFriendRequest.run('request-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['request-1', 'user-1', 'user-2'],
    ['user-2'],
    ['request-1'],
    ['request-1'],
    ['request-1'],
  ]);
});
