function createBackfillGuildRoomMemberships({
  db,
  getRoomsByGuild,
  getGuildMembers,
  addRoomMember,
} = {}) {
  return db.transaction(() => {
    const guilds = db.prepare('SELECT id FROM guilds').all();
    for (const { id: guildId } of guilds) {
      const rooms = getRoomsByGuild.all(guildId);
      if (rooms.length === 0) continue;
      const members = getGuildMembers.all(guildId);
      for (const member of members) {
        for (const room of rooms) {
          addRoomMember.run(room.id, member.id);
        }
      }
    }
  });
}

function createBackfillUniversalGuildChatAccess({
  db,
  parseStoredGuildPermissionMap,
  normalizeGuildChatPersistencePermissions,
  sanitizeGuildMemberOverridePersistence,
  updateGuildRank,
  updateMemberPermissionOverrides,
} = {}) {
  return db.transaction(() => {
    const ranks = db.prepare('SELECT id, name, permissions FROM guild_ranks').all();
    const members = db.prepare(`
      SELECT guild_id, user_id, permission_overrides
      FROM guild_members
      WHERE permission_overrides IS NOT NULL
        AND TRIM(permission_overrides) != ''
    `).all();
    let updatedRanks = 0;
    let updatedMembers = 0;

    for (const rank of ranks) {
      const permissions = parseStoredGuildPermissionMap(rank.permissions);
      const nextPermissions = normalizeGuildChatPersistencePermissions(permissions);
      if (JSON.stringify(nextPermissions) === JSON.stringify(permissions)) continue;
      updateGuildRank.run(rank.name, JSON.stringify(nextPermissions), rank.id);
      updatedRanks += 1;
    }

    for (const member of members) {
      const overrides = parseStoredGuildPermissionMap(member.permission_overrides);
      const nextOverrides = sanitizeGuildMemberOverridePersistence(overrides);
      if (JSON.stringify(nextOverrides) === JSON.stringify(overrides)) continue;
      updateMemberPermissionOverrides.run(JSON.stringify(nextOverrides), member.guild_id, member.user_id);
      updatedMembers += 1;
    }

    return { updatedRanks, updatedMembers };
  });
}

module.exports = {
  createBackfillGuildRoomMemberships,
  createBackfillUniversalGuildChatAccess,
};
