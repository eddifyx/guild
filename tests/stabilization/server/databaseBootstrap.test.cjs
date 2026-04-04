const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pickGuildMembershipToKeep,
  seedDefaultGuildInfrastructure,
} = require('../../../server/src/startup/databaseBootstrap');

test('database bootstrap prefers guild-master membership over recency when enforcing single-guild mode', () => {
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: 'guild-gm', latestGuildId: 'guild-latest' }),
    'guild-gm'
  );
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: null, latestGuildId: 'guild-latest' }),
    'guild-latest'
  );
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: null, latestGuildId: null }),
    null
  );
});

test('database bootstrap seeds default room and voice infrastructure only when enabled and empty', () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        get(...args) {
          calls.push(['get', sql, args]);
          if (sql.includes('COUNT(*) as count FROM rooms')) return { count: 0 };
          if (sql.includes('COUNT(*) as count FROM voice_channels')) return { count: 0 };
          if (sql.includes('SELECT id FROM guilds WHERE id = ?')) return null;
          return null;
        },
        run(...args) {
          calls.push(['run', sql, args]);
          return { changes: 1 };
        },
      };
    },
  };

  const result = seedDefaultGuildInfrastructure({
    db,
    shouldSeedDefaultGuild: true,
    buildDefaultGuildRankRows(guildId, { roleKeys } = {}) {
      assert.equal(guildId, 'guild-byzantine-default');
      assert.deepEqual(roleKeys, ['guildMaster', 'member']);
      return [
        { roleKey: 'guildMaster', id: 'rank-gm', guildId, name: 'Guild Master', rankOrder: 0, permissions: '{}' },
        { roleKey: 'member', id: 'rank-member', guildId, name: 'Member', rankOrder: 4, permissions: '{}' },
      ];
    },
  });

  assert.deepEqual(result, { seededRooms: 1, seededVoiceChannels: 1 });
  assert.ok(calls.some(([, sql]) => sql.includes('INSERT INTO guilds')));
  assert.ok(calls.some(([, sql]) => sql.includes('INSERT INTO rooms')));
  assert.ok(calls.some(([, sql]) => sql.includes('INSERT OR IGNORE INTO voice_channels')));
});
