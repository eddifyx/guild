const { createDbBindings } = require('./dbBindings');
const {
  db,
  hashColor,
  hashToken,
  initTables,
} = require('./dbRuntime');
const { runGuildDatabaseBackfills } = require('./domain/guild/guildBootstrapFlow');
const {
  buildDefaultGuildRankRows,
  normalizeGuildChatPersistencePermissions,
  parseStoredGuildPermissionMap,
  sanitizeGuildMemberOverridePersistence,
} = require('./domain/guild/rankPolicy');
const { runDatabaseBootstrap } = require('./startup/databaseBootstrap');

const SHOULD_SEED_DEFAULT_GUILD = process.env.SEED_DEFAULT_GUILD === '1' || process.env.SEED_DEFAULT_GUILD === 'true';

// Initialize tables immediately so prepared statements can be created safely.
initTables();

runDatabaseBootstrap({
  db,
  buildDefaultGuildRankRows,
  shouldSeedDefaultGuild: SHOULD_SEED_DEFAULT_GUILD,
  log: console,
});

const bindings = createDbBindings({ db });

runGuildDatabaseBackfills({
  db,
  getRoomsByGuild: bindings.getRoomsByGuild,
  getGuildMembers: bindings.getGuildMembers,
  addRoomMember: bindings.addRoomMember,
  parseStoredGuildPermissionMap,
  normalizeGuildChatPersistencePermissions,
  sanitizeGuildMemberOverridePersistence,
  updateGuildRank: bindings.updateGuildRank,
  updateMemberPermissionOverrides: bindings.updateMemberPermissionOverrides,
});

module.exports = {
  hashToken,
  db,
  initTables,
  hashColor,
  ...bindings,
};
