export function buildGuildSettingsResetState() {
  return {
    ranks: [],
    ranksLoaded: false,
    inviteCode: '',
    inviteLoaded: false,
    motd: '',
    motdLoaded: false,
    loading: {
      members: false,
      ranks: false,
      invite: false,
      motd: false,
    },
  };
}

export function buildGuildSettingsGuildSyncState({
  currentGuild = null,
  currentGuildData = null,
} = {}) {
  const hasMatchingGuildData = currentGuildData?.id === currentGuild;
  const hasMembers = hasMatchingGuildData && Array.isArray(currentGuildData?.members);

  return {
    guildName: currentGuildData?.name || '',
    guildDesc: currentGuildData?.description || '',
    guildPublic: currentGuildData?.is_public !== 0,
    guildImage: currentGuildData?.image_url || '',
    members: hasMembers ? currentGuildData.members : [],
    membersLoaded: hasMembers,
  };
}

export function buildGuildSettingsWarmLoadPlan({
  currentGuild = null,
  membersLoaded = false,
  motdLoaded = false,
  ranksLoaded = false,
} = {}) {
  if (!currentGuild) {
    return {
      loadMembers: false,
      loadMotd: false,
      warmRanks: false,
    };
  }

  return {
    loadMembers: !membersLoaded,
    loadMotd: !motdLoaded,
    warmRanks: !ranksLoaded,
  };
}

export function buildGuildSettingsTabLoadPlan({
  currentGuild = null,
  tab = 'Overview',
  membersLoaded = false,
  ranksLoaded = false,
  inviteLoaded = false,
  motdLoaded = false,
} = {}) {
  if (!currentGuild) {
    return {
      loadMembers: false,
      loadRanks: false,
      loadInvite: false,
      loadMotd: false,
    };
  }

  return {
    loadMembers: (tab === 'Members' || tab === 'Admin') && !membersLoaded,
    loadRanks: tab === 'Ranks' && !ranksLoaded,
    loadInvite: tab === 'Invite' && !inviteLoaded,
    loadMotd: tab === 'Overview' && !motdLoaded,
  };
}
