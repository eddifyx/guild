const {
  createBackfillGuildRoomMemberships,
  createBackfillUniversalGuildChatAccess,
} = require('./guildMaintenance');

function runGuildDatabaseBackfills({
  db,
  getRoomsByGuild,
  getGuildMembers,
  addRoomMember,
  parseStoredGuildPermissionMap,
  normalizeGuildChatPersistencePermissions,
  sanitizeGuildMemberOverridePersistence,
  updateGuildRank,
  updateMemberPermissionOverrides,
  log = console,
} = {}) {
  const backfillGuildRoomMemberships = createBackfillGuildRoomMemberships({
    db,
    getRoomsByGuild,
    getGuildMembers,
    addRoomMember,
  });
  const backfillUniversalGuildChatAccess = createBackfillUniversalGuildChatAccess({
    db,
    parseStoredGuildPermissionMap,
    normalizeGuildChatPersistencePermissions,
    sanitizeGuildMemberOverridePersistence,
    updateGuildRank,
    updateMemberPermissionOverrides,
  });

  backfillGuildRoomMemberships();
  const universalGuildChatBackfillResult = backfillUniversalGuildChatAccess();
  if (
    universalGuildChatBackfillResult.updatedRanks > 0
    || universalGuildChatBackfillResult.updatedMembers > 0
  ) {
    log.log(
      `[DB] Enabled universal /guildchat access across ${universalGuildChatBackfillResult.updatedRanks} rank(s) and cleared ${universalGuildChatBackfillResult.updatedMembers} member override(s)`
    );
  }

  return universalGuildChatBackfillResult;
}

module.exports = {
  runGuildDatabaseBackfills,
};
