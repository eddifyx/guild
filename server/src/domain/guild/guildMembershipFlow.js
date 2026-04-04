const { toGuildMemberResponse } = require('./capabilities');
const {
  applyGuildLeavePlan,
  guildFlowError,
  resolveGuildSwitchPlan,
} = require('./guildManagementFlow');

function buildGuildJoinPlan({
  guild,
  existingMembership,
  currentGuilds = [],
  guildMasterError,
  getMembership = () => null,
  lowestRank,
  requirePublic = false,
  notFoundError = 'Guild not found',
  inviteOnlyError = 'This guild is invite-only',
} = {}) {
  if (!guild) return guildFlowError(404, notFoundError);
  if (requirePublic && !guild.is_public) {
    return guildFlowError(403, inviteOnlyError);
  }
  if (existingMembership) return guildFlowError(409, 'Already a member');

  const guildSwitchPlan = resolveGuildSwitchPlan({
    userGuilds: currentGuilds,
    guildMasterError,
    getMembership,
  });
  if (guildSwitchPlan.error) {
    return guildFlowError(403, guildSwitchPlan.error);
  }
  if (!lowestRank) return guildFlowError(500, 'Guild has no ranks');

  return {
    guildId: guild.id,
    guildName: guild.name,
    guildsToLeave: guildSwitchPlan.guilds,
    lowestRankId: lowestRank.id,
  };
}

function runGuildJoinPlan({
  db,
  plan,
  userId,
  addGuildMember,
  addUserToGuildRooms,
  removeGuildMember,
  removeUserFromGuildRooms,
} = {}) {
  const joinGuild = db.transaction(() => {
    applyGuildLeavePlan({
      userId,
      guilds: plan.guildsToLeave,
      removeGuildMember,
      removeUserFromGuildRooms,
    });
    addGuildMember.run(plan.guildId, userId, plan.lowestRankId);
    addUserToGuildRooms(plan.guildId, userId);
  });

  joinGuild();
}

function buildGuildLeaveRequest({
  member,
  guildMasterError = 'Guild Master must transfer leadership before leaving',
} = {}) {
  if (member?.rank_order === 0) {
    return guildFlowError(403, guildMasterError);
  }
  return { ok: true };
}

function runGuildLeavePlan({
  guildId,
  userId,
  removeGuildMember,
  removeUserFromGuildRooms,
} = {}) {
  removeGuildMember.run(guildId, userId);
  removeUserFromGuildRooms(guildId, userId);
}

function buildGuildInviteCodeAccessPlan({
  canInvite,
  deniedError = 'No permission to invite members',
} = {}) {
  if (!canInvite) return guildFlowError(403, deniedError);
  return { ok: true };
}

function buildGuildMembersResponse({
  members = [],
  includeOfficerNote = false,
} = {}) {
  return members.map((member) => (
    toGuildMemberResponse(member, { includeOfficerNote })
  ));
}

module.exports = {
  buildGuildInviteCodeAccessPlan,
  buildGuildJoinPlan,
  buildGuildLeaveRequest,
  buildGuildMembersResponse,
  runGuildJoinPlan,
  runGuildLeavePlan,
};
