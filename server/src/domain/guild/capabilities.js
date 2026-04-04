const {
  GUILD_MASTER_PERMISSION_KEYS,
  KNOWN_GUILD_PERMISSION_KEYS,
  UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS,
} = require('./permissionModel');

const UNIVERSAL_GUILD_CHAT_PERMISSION_KEY_SET = new Set(UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS);

function parsePermissionBlob(rawValue) {
  if (!rawValue) return {};
  if (typeof rawValue === 'object') {
    return rawValue && !Array.isArray(rawValue) ? rawValue : {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeGuildPermissionMap(rawPermissions = {}, { forceUniversalGuildChat = true } = {}) {
  const parsed = parsePermissionBlob(rawPermissions);
  const normalized = {};

  for (const [permissionKey, allowed] of Object.entries(parsed)) {
    if (!KNOWN_GUILD_PERMISSION_KEYS.includes(permissionKey)) continue;
    normalized[permissionKey] = !!allowed;
  }

  if (forceUniversalGuildChat) {
    normalized.guild_chat_speak = true;
    normalized.guild_chat_listen = true;
  }

  return normalized;
}

function sanitizeGuildPermissionOverrides(rawOverrides = {}, { stripUniversalGuildChat = true } = {}) {
  const overrides = normalizeGuildPermissionMap(rawOverrides, { forceUniversalGuildChat: false });
  if (stripUniversalGuildChat) {
    delete overrides.guild_chat_speak;
    delete overrides.guild_chat_listen;
  }
  return overrides;
}

function buildEffectiveGuildPermissions({
  rankOrder,
  permissions = {},
  permissionOverrides = {},
}) {
  const effectivePermissions = normalizeGuildPermissionMap(permissions);

  if (Number(rankOrder) === 0) {
    for (const permissionKey of GUILD_MASTER_PERMISSION_KEYS) {
      effectivePermissions[permissionKey] = true;
    }
  }

  for (const [permissionKey, allowed] of Object.entries(
    sanitizeGuildPermissionOverrides(permissionOverrides)
  )) {
    effectivePermissions[permissionKey] = !!allowed;
  }

  return normalizeGuildPermissionMap(effectivePermissions);
}

function buildGuildCapabilities({ rankOrder, effectivePermissions = {} }) {
  const normalizedEffectivePermissions = normalizeGuildPermissionMap(effectivePermissions);
  const isGuildMaster = Number(rankOrder) === 0;

  return {
    isGuildMaster,
    canListenGuildChat: true,
    canSpeakGuildChat: true,
    canInviteMember: !!normalizedEffectivePermissions.invite_member,
    canRemoveMember: !!normalizedEffectivePermissions.remove_member,
    canPromoteDemote: !!normalizedEffectivePermissions.promote_demote,
    canModifyMotd: !!normalizedEffectivePermissions.modify_motd,
    canManageTheme: !!normalizedEffectivePermissions.manage_theme,
    canManageRooms: !!normalizedEffectivePermissions.manage_rooms,
    canSetPermissions: !!normalizedEffectivePermissions.set_permissions,
    effectivePermissions: normalizedEffectivePermissions,
  };
}

function buildGuildMemberState(member) {
  if (!member) return null;

  const rankOrder = Number(member.rank_order ?? member.rankOrder ?? 999);
  const permissions = normalizeGuildPermissionMap(member.permissions ?? member._perms);
  const permissionOverrides = sanitizeGuildPermissionOverrides(
    member.permission_overrides ?? member.permissionOverrides ?? member._overrides
  );
  const effectivePermissions = buildEffectiveGuildPermissions({
    rankOrder,
    permissions,
    permissionOverrides,
  });
  const capabilities = buildGuildCapabilities({ rankOrder, effectivePermissions });

  return {
    ...member,
    rankOrder,
    permissions,
    permissionOverrides,
    effectivePermissions,
    capabilities,
    _perms: permissions,
    _overrides: permissionOverrides,
    _effectivePerms: effectivePermissions,
  };
}

function hasGuildPermission(member, permissionKey) {
  if (!member) return false;
  if (UNIVERSAL_GUILD_CHAT_PERMISSION_KEY_SET.has(permissionKey)) return true;

  const guildMemberState = buildGuildMemberState(member);
  return !!guildMemberState?.effectivePermissions?.[permissionKey];
}

function toGuildMemberResponse(member, { includeOfficerNote = false } = {}) {
  const guildMemberState = buildGuildMemberState(member);
  if (!guildMemberState) return null;

  return {
    id: guildMemberState.id,
    username: guildMemberState.username,
    npub: guildMemberState.npub,
    avatarColor: guildMemberState.avatar_color,
    profilePicture: guildMemberState.profile_picture,
    rankId: guildMemberState.rank_id,
    rankName: guildMemberState.rank_name,
    rankOrder: guildMemberState.rank_order,
    permissions: guildMemberState.permissions,
    effectivePermissions: guildMemberState.effectivePermissions,
    capabilities: guildMemberState.capabilities,
    publicNote: guildMemberState.public_note,
    officerNote: includeOfficerNote ? guildMemberState.officer_note : undefined,
    permissionOverrides: guildMemberState.permissionOverrides,
    joinedAt: guildMemberState.joined_at,
    lastSeen: guildMemberState.last_seen,
  };
}

function toGuildRankResponse(rank) {
  return {
    ...rank,
    permissions: normalizeGuildPermissionMap(rank.permissions),
  };
}

function toGuildSelfRank(member) {
  const guildMemberState = buildGuildMemberState(member);
  if (!guildMemberState) return null;

  return {
    id: guildMemberState.rank_id,
    name: guildMemberState.rank_name,
    order: guildMemberState.rank_order,
    permissions: guildMemberState.effectivePermissions,
    capabilities: guildMemberState.capabilities,
  };
}

module.exports = {
  KNOWN_GUILD_PERMISSION_KEYS,
  UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS,
  buildEffectiveGuildPermissions,
  buildGuildCapabilities,
  buildGuildMemberState,
  hasGuildPermission,
  normalizeGuildPermissionMap,
  parsePermissionBlob,
  sanitizeGuildPermissionOverrides,
  toGuildMemberResponse,
  toGuildRankResponse,
  toGuildSelfRank,
};
