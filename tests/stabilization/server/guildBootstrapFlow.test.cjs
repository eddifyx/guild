const test = require('node:test');
const assert = require('node:assert/strict');

const { runGuildDatabaseBackfills } = require('../../../server/src/domain/guild/guildBootstrapFlow');

test('guild database backfills membership and universal chat access with logging', () => {
  const addedRoomMembers = [];
  const rankUpdates = [];
  const memberUpdates = [];
  const logs = [];
  const backfill = runGuildDatabaseBackfills({
    db: {
      prepare(sql) {
        return {
          all() {
            if (sql.includes('SELECT id FROM guilds')) return [{ id: 'guild-1' }];
            if (sql.includes('FROM guild_ranks')) {
              return [{ id: 'rank-1', name: 'Initiate', permissions: '{"guild_chat_speak":false}' }];
            }
            return [{ guild_id: 'guild-1', user_id: 'user-1', permission_overrides: '{"guild_chat_speak":false}' }];
          },
        };
      },
      transaction(fn) {
        return (...args) => fn(...args);
      },
    },
    getRoomsByGuild: {
      all(guildId) {
        assert.equal(guildId, 'guild-1');
        return [{ id: 'room-1' }, { id: 'room-2' }];
      },
    },
    getGuildMembers: {
      all(guildId) {
        assert.equal(guildId, 'guild-1');
        return [{ id: 'user-1' }, { id: 'user-2' }];
      },
    },
    addRoomMember: {
      run(roomId, userId) {
        addedRoomMembers.push([roomId, userId]);
      },
    },
    parseStoredGuildPermissionMap(value) {
      return JSON.parse(value);
    },
    normalizeGuildChatPersistencePermissions() {
      return { guild_chat_speak: true };
    },
    sanitizeGuildMemberOverridePersistence() {
      return {};
    },
    updateGuildRank: {
      run(name, permissions, rankId) {
        rankUpdates.push([name, permissions, rankId]);
      },
    },
    updateMemberPermissionOverrides: {
      run(overrides, guildId, userId) {
        memberUpdates.push([overrides, guildId, userId]);
      },
    },
    log: {
      log(message) {
        logs.push(message);
      },
    },
  });

  assert.deepEqual(addedRoomMembers, [
    ['room-1', 'user-1'],
    ['room-2', 'user-1'],
    ['room-1', 'user-2'],
    ['room-2', 'user-2'],
  ]);
  assert.deepEqual(rankUpdates, [['Initiate', '{"guild_chat_speak":true}', 'rank-1']]);
  assert.deepEqual(memberUpdates, [['{}', 'guild-1', 'user-1']]);
  assert.deepEqual(backfill, { updatedRanks: 1, updatedMembers: 1 });
  assert.deepEqual(logs, [
    '[DB] Enabled universal /guildchat access across 1 rank(s) and cleared 1 member override(s)',
  ]);
});
