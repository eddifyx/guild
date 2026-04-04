function sanitizeGuildAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
  if (/^\/uploads\/[a-f0-9-]+\.[a-z0-9]+$/i.test(trimmed)) return trimmed;
  return '';
}

function toGuildListEntry(guild, memberCount, { hideRawPermissions = true } = {}) {
  return {
    ...guild,
    memberCount,
    permissions: hideRawPermissions ? undefined : guild.permissions,
  };
}

function guildFlowError(status, error) {
  return { status, error };
}

function clampString(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function resolveGuildSwitchPlan({ userGuilds = [], guildMasterError, getMembership }) {
  for (const guild of userGuilds) {
    const membership = getMembership(guild.id);
    if (membership?.rank_order === 0) {
      return { guilds: [], error: guildMasterError };
    }
  }
  return { guilds: userGuilds, error: null };
}

function applyGuildLeavePlan({
  userId,
  guilds = [],
  removeGuildMember,
  removeUserFromGuildRooms,
}) {
  for (const guild of guilds) {
    removeGuildMember.run(guild.id, userId);
    removeUserFromGuildRooms(guild.id, userId);
  }
}

function buildGuildCreateInput({ name, description, image_url, is_public } = {}) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return guildFlowError(400, 'Guild name is required');
  if (trimmedName.length > 100) {
    return guildFlowError(400, 'Guild name must be 100 characters or less');
  }

  return {
    name: trimmedName,
    description: clampString(description, 500),
    imageUrl: sanitizeGuildAssetUrl(image_url),
    isPublic: !!is_public,
  };
}

function buildGuildUpdateInput({ guild, input = {} } = {}) {
  const trimmedName = (typeof input.name === 'string' && input.name.trim()
    ? input.name.trim()
    : guild?.name || '').trim();

  if (!trimmedName) return guildFlowError(400, 'Guild name is required');
  if (trimmedName.length > 100) {
    return guildFlowError(400, 'Guild name must be 100 characters or less');
  }

  return {
    name: trimmedName,
    description: input.description !== undefined
      ? clampString(input.description, 500)
      : guild.description,
    imageUrl: input.image_url !== undefined
      ? sanitizeGuildAssetUrl(input.image_url)
      : guild.image_url,
    bannerUrl: input.banner_url !== undefined
      ? sanitizeGuildAssetUrl(input.banner_url)
      : guild.banner_url,
    accentColor: input.accent_color || guild.accent_color,
    backgroundColor: input.bg_color || guild.bg_color,
    isPublic: input.is_public !== undefined ? !!input.is_public : !!guild.is_public,
  };
}

function buildMotdUpdate({ canModifyMotd, motd } = {}) {
  if (!canModifyMotd) {
    return guildFlowError(403, 'No permission to modify Message of the Day');
  }
  return { motd: clampString(motd, 500) };
}

module.exports = {
  applyGuildLeavePlan,
  buildGuildCreateInput,
  buildGuildUpdateInput,
  buildMotdUpdate,
  clampString,
  guildFlowError,
  resolveGuildSwitchPlan,
  sanitizeGuildAssetUrl,
  toGuildListEntry,
};
