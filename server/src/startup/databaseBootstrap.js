const {
  tableSqlHasUniqueUsernameConstraint,
  usersTableHasUniqueUsernameConstraint,
  pickGuildMembershipToKeep,
} = require('./databaseBootstrapModel');
const {
  migrateUsersToAllowDuplicateUsernames,
  applyLegacyGuildMasterFix,
  applyExtendedSchemaBootstrap,
} = require('./databaseBootstrapMigrations');
const {
  migrateLegacyGuildColumns,
  enforceSingleGuildMembership,
  seedDefaultGuildInfrastructure,
  renameLegacyDefaultGuild,
} = require('./databaseBootstrapGuildFlow');

function runDatabaseBootstrap({
  db,
  buildDefaultGuildRankRows,
  shouldSeedDefaultGuild,
  log = console,
} = {}) {
  migrateUsersToAllowDuplicateUsernames({ db, log });
  applyLegacyGuildMasterFix({ db });
  applyExtendedSchemaBootstrap({ db });
  migrateLegacyGuildColumns({ db, buildDefaultGuildRankRows, log });
  enforceSingleGuildMembership({ db, log });
  seedDefaultGuildInfrastructure({ db, shouldSeedDefaultGuild, buildDefaultGuildRankRows });
  renameLegacyDefaultGuild({ db });
}

module.exports = {
  tableSqlHasUniqueUsernameConstraint,
  usersTableHasUniqueUsernameConstraint,
  pickGuildMembershipToKeep,
  migrateUsersToAllowDuplicateUsernames,
  applyLegacyGuildMasterFix,
  applyExtendedSchemaBootstrap,
  migrateLegacyGuildColumns,
  enforceSingleGuildMembership,
  seedDefaultGuildInfrastructure,
  renameLegacyDefaultGuild,
  runDatabaseBootstrap,
};
