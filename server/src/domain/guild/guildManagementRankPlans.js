const { DEFAULT_GUILD_RANK_PERMISSIONS } = require('./permissionModel');
const { normalizeGuildPermissionMap } = require('./capabilities');
const { stripNonDelegableGuildPermissions } = require('./rankPolicy');
const { guildFlowError } = require('./guildManagementCore');

function buildRankCreateInput({
  canSetPermissions,
  name,
  permissions,
  lowestRank,
  existingRanksCount,
} = {}) {
  if (!canSetPermissions) return guildFlowError(403, 'No permission to manage ranks');

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return guildFlowError(400, 'Rank name required');
  if (trimmedName.length > 50) {
    return guildFlowError(400, 'Rank name must be 50 characters or less');
  }
  if (existingRanksCount >= 20) {
    return guildFlowError(429, 'Maximum 20 ranks per guild');
  }

  return {
    name: trimmedName,
    rankOrder: lowestRank ? Number(lowestRank.rank_order) + 1 : 1,
    permissions: normalizeGuildPermissionMap(
      stripNonDelegableGuildPermissions(permissions || DEFAULT_GUILD_RANK_PERMISSIONS.initiate)
    ),
  };
}

function buildRankUpdateInput({
  actorMember,
  rank,
  guildId,
  name,
  permissions,
  canRenameRanks,
  canSetPermissions,
} = {}) {
  if (!rank || rank.guild_id !== guildId) {
    return guildFlowError(404, 'Rank not found');
  }
  if (rank.rank_order === 0) {
    return guildFlowError(403, 'Cannot edit Guild Master rank permissions');
  }
  if (rank.rank_order <= actorMember.rank_order) {
    return guildFlowError(403, 'Cannot edit a rank at or above your own');
  }
  if (name !== undefined && !canRenameRanks) {
    return guildFlowError(403, 'No permission to rename ranks');
  }
  if (permissions !== undefined && !canSetPermissions) {
    return guildFlowError(403, 'No permission to set permissions');
  }

  const nextName = name !== undefined
    ? ((typeof name === 'string' ? name : '').trim().slice(0, 50) || rank.name)
    : rank.name;

  return {
    name: nextName,
    permissions: permissions !== undefined
      ? normalizeGuildPermissionMap(stripNonDelegableGuildPermissions(permissions))
      : normalizeGuildPermissionMap(rank.permissions),
  };
}

function buildRankDeletionPlan({
  actorMember,
  canSetPermissions,
  rank,
  guildId,
  allRanks = [],
} = {}) {
  if (!canSetPermissions) return guildFlowError(403, 'No permission to manage ranks');
  if (!rank || rank.guild_id !== guildId) {
    return guildFlowError(404, 'Rank not found');
  }
  if (rank.rank_order === 0) {
    return guildFlowError(403, 'Cannot delete Guild Master rank');
  }
  if (rank.rank_order <= actorMember.rank_order) {
    return guildFlowError(403, 'Cannot delete a rank at or above your own');
  }

  const sortedRanks = [...allRanks].sort((left, right) => left.rank_order - right.rank_order);
  const lowerRanks = sortedRanks.filter((candidate) => candidate.rank_order > rank.rank_order);
  const higherRanks = sortedRanks.filter(
    (candidate) => candidate.rank_order < rank.rank_order && candidate.rank_order > 0
  );
  const reassignTo = lowerRanks[0] || higherRanks[higherRanks.length - 1];

  if (!reassignTo) {
    return guildFlowError(400, 'Cannot delete the only non-GM rank');
  }

  return { reassignTo };
}

module.exports = {
  buildRankCreateInput,
  buildRankDeletionPlan,
  buildRankUpdateInput,
};
