export const GUILD_DASHBOARD_MEMBER_LIMIT = 50;
export const GUILD_DASHBOARD_STATUS_MAX_LENGTH = 128;
export const GUILD_DASHBOARD_TAVERN_MEMBER_PREVIEW_LIMIT = 8;

export function enrichGuildDashboardMembers({
  members = [],
  onlineUsers = [],
  onlineIds = new Set(),
} = {}) {
  const onlineUsersById = new Map(onlineUsers.map((entry) => [entry.userId, entry]));

  return members
    .map((member) => {
      const onlineData = onlineUsersById.get(member.id);
      return {
        ...member,
        isOnline: onlineIds.has(member.id),
        customStatus: onlineData?.customStatus || '',
        profilePicture: onlineData?.profilePicture || member.profilePicture || null,
      };
    })
    .sort((left, right) => {
      if (left.isOnline !== right.isOnline) {
        return left.isOnline ? -1 : 1;
      }
      return (left.rankOrder ?? 999) - (right.rankOrder ?? 999);
    });
}

export function buildGuildDashboardRosterState({
  members = [],
  showOffline = false,
  showExpandedRoster = false,
  memberLimit = GUILD_DASHBOARD_MEMBER_LIMIT,
  previewLimit = GUILD_DASHBOARD_TAVERN_MEMBER_PREVIEW_LIMIT,
} = {}) {
  const onlineMembers = members.filter((member) => member.isOnline);
  const memberPool = showOffline ? members : onlineMembers;
  const visibleMembers = showExpandedRoster
    ? memberPool.slice(0, memberLimit)
    : memberPool.slice(0, previewLimit);

  return {
    onlineCount: onlineMembers.length,
    onlineMembers,
    memberPool,
    visibleMembers,
    totalMemberCount: members.length,
    hasMore: memberPool.length > visibleMembers.length,
    isRosterExpanded: showExpandedRoster,
  };
}

export function formatGuildDashboardLastSeen(timestamp, nowMs = Date.now()) {
  if (!timestamp) return 'Never';
  const diff = nowMs - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function buildGuildDashboardStatusPopover({
  member = null,
  rect = null,
  currentUserId = null,
} = {}) {
  const status = member?.customStatus?.trim();
  if (!member || !status || !rect) {
    return null;
  }

  return {
    username: member.id === currentUserId ? 'You' : member.username,
    status,
    position: {
      x: rect.left,
      y: rect.bottom,
      top: rect.top,
    },
  };
}
