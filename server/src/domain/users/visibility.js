function buildVisibleUserIdSet({
  requesterUserId = null,
  guildmateRows = [],
  contactRows = [],
} = {}) {
  const visibleUserIds = new Set();
  if (requesterUserId) {
    visibleUserIds.add(requesterUserId);
  }

  for (const row of Array.isArray(guildmateRows) ? guildmateRows : []) {
    if (row?.user_id) {
      visibleUserIds.add(row.user_id);
    }
  }

  for (const row of Array.isArray(contactRows) ? contactRows : []) {
    if (row?.user_id) {
      visibleUserIds.add(row.user_id);
    }
  }

  return visibleUserIds;
}

function buildVisibleUsers(users = []) {
  return (Array.isArray(users) ? users : [])
    .filter((user) => user && !user.id.startsWith('system-'))
    .sort((leftUser, rightUser) => leftUser.username.localeCompare(rightUser.username));
}

function canAccessVisibleUser({ requesterUserId, targetUserId, visibleUserIds } = {}) {
  if (!requesterUserId || !targetUserId) return false;
  if (requesterUserId === targetUserId) return true;
  return visibleUserIds instanceof Set ? visibleUserIds.has(targetUserId) : false;
}

module.exports = {
  buildVisibleUserIdSet,
  buildVisibleUsers,
  canAccessVisibleUser,
};
