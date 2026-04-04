const UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS = new Set(['guild_chat_speak', 'guild_chat_listen']);

function parseGuildPermissionMap(rawValue) {
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
  const parsed = parseGuildPermissionMap(rawPermissions);
  const normalized = {};

  for (const [permissionKey, allowed] of Object.entries(parsed)) {
    normalized[permissionKey] = !!allowed;
  }

  if (forceUniversalGuildChat) {
    normalized.guild_chat_speak = true;
    normalized.guild_chat_listen = true;
  }

  return normalized;
}

export function stripUniversalGuildChatPermissions(rawPermissions = {}) {
  const normalized = normalizeGuildPermissionMap(rawPermissions, { forceUniversalGuildChat: false });
  delete normalized.guild_chat_speak;
  delete normalized.guild_chat_listen;
  return normalized;
}

export function getGuildMemberEffectivePermissions(member, { optimisticIfMissing = false } = {}) {
  if (!member) return {};

  if (member.effectivePermissions) {
    return normalizeGuildPermissionMap(member.effectivePermissions);
  }

  const permissions = member.permissions;
  const permissionOverrides = member.permissionOverrides ?? member.permission_overrides;
  const hasExplicitPermissions = permissions != null;

  if (!hasExplicitPermissions && optimisticIfMissing) {
    return normalizeGuildPermissionMap({});
  }

  const basePermissions = normalizeGuildPermissionMap(permissions);
  const overrides = stripUniversalGuildChatPermissions(permissionOverrides);

  return normalizeGuildPermissionMap({
    ...basePermissions,
    ...overrides,
  });
}

export function getGuildMemberCapabilities(member, { optimisticIfMissing = false } = {}) {
  const effectivePermissions = getGuildMemberEffectivePermissions(member, { optimisticIfMissing });
  const rankOrder = Number(member?.rankOrder ?? member?.rank_order ?? 999);

  if (member?.capabilities && typeof member.capabilities === 'object') {
    return {
      ...member.capabilities,
      isGuildMaster: rankOrder === 0,
      canListenGuildChat: true,
      canSpeakGuildChat: true,
      effectivePermissions,
    };
  }

  return {
    isGuildMaster: rankOrder === 0,
    canListenGuildChat: true,
    canSpeakGuildChat: true,
    canInviteMember: !!effectivePermissions.invite_member,
    canRemoveMember: !!effectivePermissions.remove_member,
    canPromoteDemote: !!effectivePermissions.promote_demote,
    canModifyMotd: !!effectivePermissions.modify_motd,
    canManageTheme: !!effectivePermissions.manage_theme,
    canManageRooms: !!effectivePermissions.manage_rooms,
    canSetPermissions: !!effectivePermissions.set_permissions,
    effectivePermissions,
  };
}

export function hasGuildPermission(member, permissionKey, { optimisticIfMissing = false } = {}) {
  if (UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS.has(permissionKey)) return true;
  if (!member) return !!optimisticIfMissing;

  const effectivePermissions = getGuildMemberEffectivePermissions(member, { optimisticIfMissing });
  if (!member.effectivePermissions && member.permissions == null && optimisticIfMissing) {
    return true;
  }

  return !!effectivePermissions[permissionKey];
}

export {
  UNIVERSAL_GUILD_CHAT_PERMISSION_KEYS,
  normalizeGuildPermissionMap,
  parseGuildPermissionMap,
};
