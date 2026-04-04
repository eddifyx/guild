const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEffectiveGuildPermissions,
  buildGuildCapabilities,
  normalizeGuildPermissionMap,
  sanitizeGuildPermissionOverrides,
} = require('../../../server/src/domain/guild/capabilities');
const {
  DEFAULT_GUILD_RANK_PERMISSIONS,
} = require('../../../server/src/domain/guild/permissionModel');

test('normalizeGuildPermissionMap strips unknown keys and forces universal guild chat access', () => {
  const normalized = normalizeGuildPermissionMap({
    invite_member: 1,
    guild_chat_speak: false,
    guild_chat_listen: false,
    unknown_permission_key: true,
  });

  assert.equal(normalized.invite_member, true);
  assert.equal(normalized.guild_chat_speak, true);
  assert.equal(normalized.guild_chat_listen, true);
  assert.equal(Object.hasOwn(normalized, 'unknown_permission_key'), false);
});

test('sanitizeGuildPermissionOverrides removes universal guild chat overrides', () => {
  const overrides = sanitizeGuildPermissionOverrides({
    invite_member: false,
    guild_chat_speak: false,
    guild_chat_listen: false,
  });

  assert.deepEqual(overrides, {
    invite_member: false,
  });
});

test('buildEffectiveGuildPermissions applies overrides while preserving guild chat invariants', () => {
  const effectivePermissions = buildEffectiveGuildPermissions({
    rankOrder: 4,
    permissions: DEFAULT_GUILD_RANK_PERMISSIONS.initiate,
    permissionOverrides: {
      invite_member: true,
      guild_chat_speak: false,
      guild_chat_listen: false,
    },
  });

  assert.equal(effectivePermissions.invite_member, true);
  assert.equal(effectivePermissions.guild_chat_speak, true);
  assert.equal(effectivePermissions.guild_chat_listen, true);
});

test('buildGuildCapabilities treats guild master as fully empowered while keeping guild chat universal', () => {
  const capabilities = buildGuildCapabilities({
    rankOrder: 0,
    effectivePermissions: {
      invite_member: false,
      guild_chat_speak: false,
    },
  });

  assert.equal(capabilities.isGuildMaster, true);
  assert.equal(capabilities.canListenGuildChat, true);
  assert.equal(capabilities.canSpeakGuildChat, true);
});
