const test = require('node:test');
const assert = require('node:assert/strict');

const { createUsersRepository } = require('../../../server/src/repositories/usersRepository');

test('users repository exposes canonical lookup and profile persistence operations', () => {
  const calls = [];
  const repository = createUsersRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'user-1', username: 'builder' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'user-1' }];
          },
        };
      },
    },
  });

  repository.createUser.run('user-1', 'builder', '#fff');
  repository.getUserByUsername.get('builder');
  repository.getUserById.get('user-1');
  repository.getAllUsers.all();
  repository.updateUserUsername.run('scout', 'user-1');
  repository.updateUserLud16.run('name@example.com', 'user-1');
  repository.updateUserProfilePicture.run('https://example.com/pic.png', 'user-1');
  repository.updateUserStatus.run('online', 'user-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['user-1', 'builder', '#fff'],
    ['builder'],
    ['user-1'],
    [],
    ['scout', 'user-1'],
    ['name@example.com', 'user-1'],
    ['https://example.com/pic.png', 'user-1'],
    ['online', 'user-1'],
  ]);
});

test('users repository supports nostr-aware lookups and session freshness writes', () => {
  const calls = [];
  const repository = createUsersRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'user-1', npub: 'npub1builder' };
          },
          all() {
            return [];
          },
        };
      },
    },
  });

  repository.getUserByNpub.get('npub1builder');
  repository.createUserWithNpub.run('user-1', 'builder', '#fff', 'npub1builder', 'name@example.com', null);
  repository.updateLastSeen.run('user-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['npub1builder'],
    ['user-1', 'builder', '#fff', 'npub1builder', 'name@example.com', null],
    ['user-1'],
  ]);
});
