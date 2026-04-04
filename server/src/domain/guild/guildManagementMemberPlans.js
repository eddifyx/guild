const {
  KNOWN_GUILD_PERMISSION_KEYS,
  sanitizeGuildPermissionOverrides,
} = require('./capabilities');
const { stripNonDelegableGuildPermissions } = require('./rankPolicy');
const { clampString, guildFlowError } = require('./guildManagementCore');

function buildMemberPermissionOverrideUpdate({
  actorMember,
  actorUserId,
  targetUserId,
  targetMember,
  overrides,
  knownPermissionKeys = KNOWN_GUILD_PERMISSION_KEYS,
} = {}) {
  if (actorMember?.rank_order !== 0) {
    return guildFlowError(403, 'Only the Guild Master can set per-member permissions');
  }
  if (!targetMember) return guildFlowError(404, 'User is not a member');
  if (targetUserId === actorUserId) {
    return guildFlowError(400, 'Cannot set permission overrides on yourself');
  }
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return guildFlowError(400, 'overrides object required');
  }

  const allowedPermissionKeys = new Set(knownPermissionKeys);
  const cleanedOverridesInput = stripNonDelegableGuildPermissions(overrides);
  const filteredOverrides = {};

  for (const [permissionKey, allowed] of Object.entries(cleanedOverridesInput)) {
    if (!allowedPermissionKeys.has(permissionKey)) continue;
    filteredOverrides[permissionKey] = !!allowed;
  }

  return {
    normalizedOverrides: sanitizeGuildPermissionOverrides(filteredOverrides),
  };
}

function buildLeadershipTransferPlan({
  actorMember,
  targetUserId,
  targetMember,
  ranks = [],
} = {}) {
  if (actorMember?.rank_order !== 0) {
    return guildFlowError(403, 'Only the Guild Master can transfer leadership');
  }
  if (!targetUserId) return guildFlowError(400, 'Target user ID required');
  if (!targetMember) return guildFlowError(404, 'Target user is not a member');

  const guildMasterRank = ranks.find((rank) => rank.rank_order === 0);
  const fallbackOfficerRank = ranks.find((rank) => rank.rank_order === 1)
    || ranks.find((rank) => rank.rank_order === 3);

  if (!guildMasterRank || !fallbackOfficerRank) {
    return guildFlowError(500, 'Guild rank structure is broken');
  }

  return {
    guildMasterRankId: guildMasterRank.id,
    demotedRankId: fallbackOfficerRank.id,
    newLeaderId: targetUserId,
  };
}

function buildRankAssignmentPlan({
  actorMember,
  canPromoteDemote,
  targetMember,
  rankId,
  newRank,
  guildId,
} = {}) {
  if (!canPromoteDemote) return guildFlowError(403, 'No permission to change ranks');
  if (!targetMember) return guildFlowError(404, 'User is not a member');
  if (targetMember.rank_order <= actorMember.rank_order) {
    return guildFlowError(403, 'Cannot change rank of someone at or above your rank');
  }
  if (!rankId) return guildFlowError(400, 'Rank ID required');
  if (!newRank || newRank.guild_id !== guildId) {
    return guildFlowError(404, 'Rank not found in this guild');
  }
  if (newRank.rank_order <= actorMember.rank_order) {
    return guildFlowError(403, 'Cannot promote someone to your rank or above');
  }

  return {
    rankId,
    rankName: newRank.name,
  };
}

function buildMemberNoteUpdate({
  actorUserId,
  targetUserId,
  publicNote,
  officerNote,
  canEditPublicNote,
  canEditOfficerNote,
} = {}) {
  if (publicNote !== undefined && targetUserId !== actorUserId && !canEditPublicNote) {
    return guildFlowError(403, 'No permission to edit public notes');
  }
  if (officerNote !== undefined && !canEditOfficerNote) {
    return guildFlowError(403, 'No permission to edit officer notes');
  }

  return {
    publicNote: publicNote !== undefined ? clampString(publicNote, 200) : undefined,
    officerNote: officerNote !== undefined ? clampString(officerNote, 500) : undefined,
  };
}

function buildMemberRemovalPlan({
  actorMember,
  canRemoveMember,
  targetMember,
} = {}) {
  if (!canRemoveMember) return guildFlowError(403, 'No permission to kick members');
  if (!targetMember) return guildFlowError(404, 'User is not a member');
  if (targetMember.rank_order <= actorMember.rank_order) {
    return guildFlowError(403, 'Cannot kick someone at or above your rank');
  }
  return { ok: true };
}

module.exports = {
  buildLeadershipTransferPlan,
  buildMemberNoteUpdate,
  buildMemberPermissionOverrideUpdate,
  buildMemberRemovalPlan,
  buildRankAssignmentPlan,
};
