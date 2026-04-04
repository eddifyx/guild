const {
  DEFAULT_GUILD_RANK_PERMISSIONS,
  NON_DELEGABLE_GUILD_PERMISSION_KEYS,
  UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS,
} = require('./permissionModel');

const DEFAULT_GUILD_RANK_ROLE_ORDER = ['guildMaster', 'officer', 'veteran', 'member', 'initiate'];

const DEFAULT_GUILD_RANK_NAMES = {
  guildMaster: 'Guild Master',
  officer: 'Officer',
  veteran: 'Veteran',
  member: 'Member',
  initiate: 'Initiate',
};

const GUILD_RANK_ORDER_BY_ROLE = Object.fromEntries(
  DEFAULT_GUILD_RANK_ROLE_ORDER.map((roleKey, index) => [roleKey, index])
);

function cloneDefaultGuildRankPermissions(roleKey) {
  const template = DEFAULT_GUILD_RANK_PERMISSIONS?.[roleKey] || {};
  return { ...template };
}

function serializeDefaultGuildRankPermissions(roleKey) {
  return JSON.stringify(cloneDefaultGuildRankPermissions(roleKey));
}

function buildDefaultGuildRankRows(guildId, { roleKeys = DEFAULT_GUILD_RANK_ROLE_ORDER } = {}) {
  return (roleKeys || [])
    .filter((roleKey) => Object.hasOwn(DEFAULT_GUILD_RANK_NAMES, roleKey))
    .map((roleKey) => ({
      roleKey,
      id: `rank-${guildId}-${GUILD_RANK_ORDER_BY_ROLE[roleKey]}`,
      guildId,
      name: DEFAULT_GUILD_RANK_NAMES[roleKey],
      rankOrder: GUILD_RANK_ORDER_BY_ROLE[roleKey],
      permissions: serializeDefaultGuildRankPermissions(roleKey),
    }));
}

function parseStoredGuildPermissionMap(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return {};

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stripNonDelegableGuildPermissions(rawPermissions = {}) {
  if (!rawPermissions || typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
    return {};
  }

  const nextPermissions = { ...rawPermissions };
  for (const permissionKey of NON_DELEGABLE_GUILD_PERMISSION_KEYS) {
    delete nextPermissions[permissionKey];
  }
  return nextPermissions;
}

function normalizeGuildChatPersistencePermissions(permissions = {}) {
  const normalizedPermissions = {
    ...stripNonDelegableGuildPermissions(permissions),
    guild_chat_speak: true,
    guild_chat_listen: true,
  };

  return normalizedPermissions;
}

function sanitizeGuildMemberOverridePersistence(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {};
  }

  const nextOverrides = { ...overrides };
  for (const permissionKey of UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS) {
    delete nextOverrides[permissionKey];
  }
  for (const permissionKey of NON_DELEGABLE_GUILD_PERMISSION_KEYS) {
    delete nextOverrides[permissionKey];
  }
  return nextOverrides;
}

module.exports = {
  DEFAULT_GUILD_RANK_NAMES,
  DEFAULT_GUILD_RANK_ROLE_ORDER,
  buildDefaultGuildRankRows,
  cloneDefaultGuildRankPermissions,
  normalizeGuildChatPersistencePermissions,
  parseStoredGuildPermissionMap,
  sanitizeGuildMemberOverridePersistence,
  serializeDefaultGuildRankPermissions,
  stripNonDelegableGuildPermissions,
};
