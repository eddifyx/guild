const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBackfillGuildRoomMemberships,
  createBackfillUniversalGuildChatAccess,
} = require('../../../server/src/domain/guild/guildMaintenance');

test('guild maintenance backfills room membership across every guild room/member combination', () => {
  const added = [];
  const backfill = createBackfillGuildRoomMemberships({
    db: {
      prepare(sql) {
        return {
          all() {
            assert.match(sql, /SELECT id FROM guilds/);
            return [{ id: 'guild-1' }];
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
        added.push([roomId, userId]);
      },
    },
  });

  backfill();

  assert.deepEqual(added, [
    ['room-1', 'user-1'],
    ['room-2', 'user-1'],
    ['room-1', 'user-2'],
    ['room-2', 'user-2'],
  ]);
});

test('guild maintenance normalizes rank and member overrides while reporting updated counts', () => {
  const rankUpdates = [];
  const memberUpdates = [];
  const backfill = createBackfillUniversalGuildChatAccess({
    db: {
      prepare(sql) {
        return {
          all() {
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
  });

  const result = backfill();

  assert.deepEqual(rankUpdates, [['Initiate', '{"guild_chat_speak":true}', 'rank-1']]);
  assert.deepEqual(memberUpdates, [['{}', 'guild-1', 'user-1']]);
  assert.deepEqual(result, { updatedRanks: 1, updatedMembers: 1 });
});
