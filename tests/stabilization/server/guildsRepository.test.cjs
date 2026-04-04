const test = require('node:test');
const assert = require('node:assert/strict');

const { createGuildsRepository } = require('../../../server/src/repositories/guildsRepository');

test('guilds repository exposes canonical guild and rank persistence operations', () => {
  const calls = [];
  const repository = createGuildsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'guild-1', rank_id: 'rank-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'guild-1' }];
          },
        };
      },
    },
  });

  repository.createGuild.run('guild-1', 'Guild', 'desc', null, null, null, null, 'user-1', 1, 'invite');
  repository.getGuildById.get('guild-1');
  repository.createGuildRank.run('rank-1', 'guild-1', 'GM', 0, '{}');
  repository.getGuildRanks.all('guild-1');
  repository.updateGuildRank.run('Officer', '{"guild_chat_speak":true}', 'rank-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['guild-1', 'Guild', 'desc', null, null, null, null, 'user-1', 1, 'invite'],
    ['guild-1'],
    ['rank-1', 'guild-1', 'GM', 0, '{}'],
    ['guild-1'],
    ['Officer', '{"guild_chat_speak":true}', 'rank-1'],
  ]);
});

test('guilds repository exposes canonical membership persistence operations', () => {
  const calls = [];
  const repository = createGuildsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { guild_id: 'guild-1', user_id: 'user-1', rank_id: 'rank-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'user-1' }];
          },
        };
      },
    },
  });

  repository.addGuildMember.run('guild-1', 'user-1', 'rank-1');
  repository.getGuildMembers.all('guild-1');
  repository.isGuildMember.get('guild-1', 'user-1');
  repository.updateMemberRank.run('rank-2', 'guild-1', 'user-1');
  repository.updateMemberPermissionOverrides.run('{"manage_guild":false}', 'guild-1', 'user-1');
  repository.removeGuildMember.run('guild-1', 'user-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['guild-1', 'user-1', 'rank-1'],
    ['guild-1'],
    ['guild-1', 'user-1'],
    ['rank-2', 'guild-1', 'user-1'],
    ['{"manage_guild":false}', 'guild-1', 'user-1'],
    ['guild-1', 'user-1'],
  ]);
});
