function createUsersVisibilityRepository({ db }) {
  const listVisibleGuildmateIds = db.prepare(
    `SELECT DISTINCT gm_other.user_id AS user_id
     FROM guild_members gm_self
     JOIN guild_members gm_other ON gm_self.guild_id = gm_other.guild_id
     WHERE gm_self.user_id = ?`
  );
  const listVisibleContactUserIds = db.prepare(
    `SELECT DISTINCT u.id AS user_id
     FROM contacts c
     JOIN users u ON u.npub = c.contact_npub
     WHERE c.user_id = ?`
  );

  return {
    listVisibleGuildmateIds,
    listVisibleContactUserIds,
  };
}

module.exports = {
  createUsersVisibilityRepository,
};
