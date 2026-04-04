import { stripUniversalGuildChatPermissions } from './capabilities.js';

export function buildGuildSettingsOverviewImageState({
  guildImage = '',
  imagePreview = null,
  getFileUrlFn = (fileUrl) => fileUrl,
} = {}) {
  return {
    imgSrc: imagePreview || (guildImage ? getFileUrlFn(guildImage) : null),
  };
}

export function buildGuildSettingsRankOptionsByCurrentRankId({
  ranks = [],
  myRankOrder = 999,
} = {}) {
  const assignableRanks = ranks.filter((rank) => rank.rank_order > myRankOrder);
  const next = new Map();

  for (const rank of ranks) {
    if (rank.rank_order > myRankOrder) {
      next.set(rank.id, assignableRanks);
      continue;
    }

    next.set(rank.id, [...assignableRanks, rank].sort((a, b) => a.rank_order - b.rank_order));
  }

  return next;
}

export function buildGuildSettingsMemberCountLabel(memberCount = 0) {
  return `${memberCount} member${memberCount === 1 ? '' : 's'}`;
}

export function createGuildSettingsOverrideEditState(member = null) {
  return stripUniversalGuildChatPermissions(member?.permissionOverrides);
}

export function buildGuildSettingsMemberRowState({
  member = null,
  rankOptionsByCurrentRankId = new Map(),
  myRankOrder = 999,
  showControls = false,
  isGuildMaster = false,
  userId = null,
  expandedMemberId = null,
} = {}) {
  const canModify = !!member
    && showControls
    && myRankOrder < member.rankOrder
    && member.id !== userId;
  const canEditOverrides = !!member
    && isGuildMaster
    && member.id !== userId
    && member.rankOrder !== 0;

  return {
    canModify,
    canEditOverrides,
    rankOptions: rankOptionsByCurrentRankId.get(member?.rankId) || [],
    hasOverrides: Object.keys(stripUniversalGuildChatPermissions(member?.permissionOverrides)).length > 0,
    isExpanded: expandedMemberId === member?.id,
    rankPermissions: stripUniversalGuildChatPermissions(member?.permissions),
    avatarLetter: member?.username?.[0]?.toUpperCase() || '?',
  };
}

export function applyGuildSettingsOverrideToggle({
  previousEdits = {},
  permission = '',
  nextValue = false,
  rankDefault = false,
} = {}) {
  if (nextValue === rankDefault) {
    const next = { ...previousEdits };
    delete next[permission];
    return next;
  }

  return {
    ...previousEdits,
    [permission]: nextValue,
  };
}

export function buildGuildSettingsRankRowState({
  rank = null,
  editingRank = null,
  myRankOrder = 999,
  canSetPerms = false,
} = {}) {
  return {
    isEditing: editingRank === rank?.id,
    canEdit: canSetPerms && Number(rank?.rank_order ?? 999) > myRankOrder,
  };
}

export function buildGuildSettingsAdminState({
  members = [],
  userId = null,
} = {}) {
  return {
    otherMembers: members.filter((member) => member.id !== userId),
  };
}
