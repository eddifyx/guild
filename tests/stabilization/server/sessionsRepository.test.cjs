const test = require('node:test');
const assert = require('node:assert/strict');

const { createSessionsRepository } = require('../../../server/src/repositories/sessionsRepository');

test('sessions repository inserts sessions with the canonical token and user ordering', () => {
  const calls = [];
  const repository = createSessionsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { token: args[0], user_id: 'user-1' };
          },
        };
      },
    },
  });

  repository.createSession.run('hashed-token', 'user-1');
  const session = repository.getSession.get('hashed-token');

  assert.deepEqual(calls[0].args, ['hashed-token', 'user-1']);
  assert.deepEqual(calls[1].args, ['hashed-token']);
  assert.equal(session.token, 'hashed-token');
});

test('sessions repository exposes delete operations for single, user-wide, and expired sessions', () => {
  const calls = [];
  const repository = createSessionsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
        };
      },
    },
  });

  repository.deleteSession.run('hashed-token');
  repository.deleteUserSessions.run('user-1');
  repository.deleteExpiredSessions.run();

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['hashed-token'],
    ['user-1'],
    [],
  ]);
});
