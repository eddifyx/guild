function tableSqlHasUniqueUsernameConstraint(tableSql) {
  const sql = String(tableSql || '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  return sql.includes('USERNAME TEXT NOT NULL UNIQUE')
    || sql.includes('UNIQUE(USERNAME)')
    || sql.includes('UNIQUE (USERNAME)');
}

function usersTableHasUniqueUsernameConstraint({ db } = {}) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  return tableSqlHasUniqueUsernameConstraint(row?.sql || '');
}

function pickGuildMembershipToKeep({ guildMasterGuildId, latestGuildId } = {}) {
  return guildMasterGuildId || latestGuildId || null;
}

module.exports = {
  tableSqlHasUniqueUsernameConstraint,
  usersTableHasUniqueUsernameConstraint,
  pickGuildMembershipToKeep,
};
