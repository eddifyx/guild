const test = require('node:test');
const assert = require('node:assert/strict');

const { createUsersVisibilityRepository } = require('../../../server/src/repositories/usersVisibilityRepository');

test('users visibility repository exposes canonical guildmate and contact visibility queries', () => {
  const calls = [];
  const repository = createUsersVisibilityRepository({
    db: {
      prepare(sql) {
        return {
          all(...args) {
            calls.push({ sql, args });
            return sql.includes('JOIN guild_members')
              ? [{ user_id: 'guildmate-1' }]
              : [{ user_id: 'contact-1' }];
          },
        };
      },
    },
  });

  assert.deepEqual(repository.listVisibleGuildmateIds.all('user-1'), [{ user_id: 'guildmate-1' }]);
  assert.deepEqual(repository.listVisibleContactUserIds.all('user-1'), [{ user_id: 'contact-1' }]);
  assert.deepEqual(calls.map((entry) => entry.args), [['user-1'], ['user-1']]);
});
