const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_GUILD_RANK_NAMES,
  buildDefaultGuildRankRows,
  normalizeGuildChatPersistencePermissions,
  parseStoredGuildPermissionMap,
  sanitizeGuildMemberOverridePersistence,
  serializeDefaultGuildRankPermissions,
  stripNonDelegableGuildPermissions,
} = require('../../../server/src/domain/guild/rankPolicy');

test('guild rank policy builds stable default rank rows for seeded guilds', () => {
  const rows = buildDefaultGuildRankRows('guild-1');

  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => ({
      roleKey: row.roleKey,
      id: row.id,
      name: row.name,
      rankOrder: row.rankOrder,
    })),
    [
      { roleKey: 'guildMaster', id: 'rank-guild-1-0', name: 'Guild Master', rankOrder: 0 },
      { roleKey: 'officer', id: 'rank-guild-1-1', name: 'Officer', rankOrder: 1 },
      { roleKey: 'veteran', id: 'rank-guild-1-2', name: 'Veteran', rankOrder: 2 },
      { roleKey: 'member', id: 'rank-guild-1-3', name: 'Member', rankOrder: 3 },
      { roleKey: 'initiate', id: 'rank-guild-1-4', name: 'Initiate', rankOrder: 4 },
    ]
  );

  assert.equal(rows[0].permissions, serializeDefaultGuildRankPermissions('guildMaster'));
  assert.equal(rows[4].permissions, serializeDefaultGuildRankPermissions('initiate'));
});

test('guild rank policy can build partial seed sets while preserving canonical rank order', () => {
  const rows = buildDefaultGuildRankRows('guild-2', {
    roleKeys: ['guildMaster', 'member'],
  });

  assert.deepEqual(rows, [
    {
      roleKey: 'guildMaster',
      id: 'rank-guild-2-0',
      guildId: 'guild-2',
      name: DEFAULT_GUILD_RANK_NAMES.guildMaster,
      rankOrder: 0,
      permissions: serializeDefaultGuildRankPermissions('guildMaster'),
    },
    {
      roleKey: 'member',
      id: 'rank-guild-2-3',
      guildId: 'guild-2',
      name: DEFAULT_GUILD_RANK_NAMES.member,
      rankOrder: 3,
      permissions: serializeDefaultGuildRankPermissions('member'),
    },
  ]);
});

test('guild rank policy parses stored permission blobs and tolerates invalid input', () => {
  assert.deepEqual(parseStoredGuildPermissionMap('{"invite_member":true}'), { invite_member: true });
  assert.deepEqual(parseStoredGuildPermissionMap('{not-json}'), {});
  assert.deepEqual(parseStoredGuildPermissionMap(null), {});
});

test('guild rank policy forces universal guild chat access while stripping non-delegable keys', () => {
  const normalized = normalizeGuildChatPersistencePermissions({
    invite_member: false,
    guild_chat_speak: false,
    guild_chat_listen: false,
    disband_guild: true,
  });

  assert.deepEqual(normalized, {
    invite_member: false,
    guild_chat_speak: true,
    guild_chat_listen: true,
  });
});

test('guild rank policy strips non-delegable rank permissions without mutating the source object', () => {
  const rawPermissions = {
    invite_member: true,
    disband_guild: true,
    transfer_leadership: true,
  };

  assert.deepEqual(stripNonDelegableGuildPermissions(rawPermissions), {
    invite_member: true,
  });
  assert.deepEqual(rawPermissions, {
    invite_member: true,
    disband_guild: true,
    transfer_leadership: true,
  });
});

test('guild rank policy strips universal and non-delegable member overrides', () => {
  const overrides = sanitizeGuildMemberOverridePersistence({
    invite_member: true,
    guild_chat_speak: false,
    guild_chat_listen: false,
    transfer_leadership: true,
  });

  assert.deepEqual(overrides, {
    invite_member: true,
  });
});
