export function buildNostrProfileViewState({
  user = null,
  profile = null,
  onlineUsers = [],
  currentGuildData = null,
} = {}) {
  const npub = user?.npub || '';
  const displayName = profile
    ? (profile.name || profile.display_name || user?.username || 'Anonymous')
    : (user?.username || 'Anonymous');
  const picture = profile ? (profile.picture || '') : (user?.profilePicture || '');
  const about = profile ? (profile.about || '') : '';
  const me = onlineUsers.find((entry) => entry?.userId === user?.userId);
  const myStatus = me?.customStatus || '';
  const guildName = currentGuildData?.name || 'Guild';
  const guildMemberCount = currentGuildData?.member_count || '—';
  const guildInitial = guildName?.[0]?.toUpperCase() || 'G';
  const npubLabel = npub ? `${npub.slice(0, 20)}...${npub.slice(-6)}` : '';

  return {
    about,
    displayName,
    guildInitial,
    guildMemberCount,
    guildName,
    myStatus,
    npub,
    npubLabel,
    picture,
  };
}

