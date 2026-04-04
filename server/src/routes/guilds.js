const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const auth = require('../middleware/authMiddleware');
const { broadcastPresenceUpdates } = require('../socket/presenceHandler');
const { destroyLiveVoiceChannel } = require('../socket/voiceHandler');
const {
  db,
  createGuild, getGuildById, getAllPublicGuilds, getGuildByInviteCode,
  updateGuild, updateGuildMotd, deleteGuildRow, getUserCreatedGuildCount, updateGuildInviteCode,
  createGuildRank, getGuildRanks, getGuildRankById, updateGuildRank, deleteGuildRank, getLowestRank,
  addGuildMember, removeGuildMember, getGuildMembers, getUserGuilds,
  createRoom, addRoomMember, createVoiceChannel,
  addUserToGuildRooms, removeUserFromGuildRooms,
  isGuildMember, updateMemberRank, updatePublicNote, updateOfficerNote,
  updateMemberPermissionOverrides,
  getGuildMemberCount, deleteGuildMembers, deleteGuildRanks,
  getRoomsByGuild, getVoiceChannelsByGuild,
  deleteRoomAttachments, deleteRoomMessages, deleteRoomMembers, deleteRoomRow,
  deleteSenderKeyDistributionsForRoom,
  clearChannelVoiceSessions, deleteVoiceChannel,
} = require('../db');
const { ERROR_CODES } = require('../contracts/errorCodes');
const {
  buildGuildMemberState,
  hasGuildPermission,
  toGuildRankResponse,
  toGuildSelfRank,
} = require('../domain/guild/capabilities');
const {
  buildGuildCreateInput,
  buildGuildUpdateInput,
  buildLeadershipTransferPlan,
  buildMemberNoteUpdate,
  buildMemberPermissionOverrideUpdate,
  buildMemberRemovalPlan,
  buildMotdUpdate,
  buildRankAssignmentPlan,
  buildRankCreateInput,
  buildRankDeletionPlan,
  buildRankUpdateInput,
  resolveGuildSwitchPlan,
  toGuildListEntry,
} = require('../domain/guild/guildManagementFlow');
const {
  buildGuildInviteCodeAccessPlan,
  buildGuildJoinPlan,
  buildGuildLeaveRequest,
  buildGuildMembersResponse,
  runGuildJoinPlan,
  runGuildLeavePlan,
} = require('../domain/guild/guildMembershipFlow');
const {
  runGuildCreateFlow,
  runGuildDisbandFlow,
  runGuildLeadershipTransferFlow,
  runGuildRankDeletionFlow,
} = require('../domain/guild/guildPersistenceFlow');
const {
  emitToGuildMembersRuntime,
  emitGuildMemberLeftEvents,
  emitGuildMemberJoinedEvent,
  emitGuildMemberKickedEvent,
  emitGuildDisbandedEvent,
  emitGuildLeadershipTransferredEvent,
  emitGuildMotdUpdatedEvent,
  emitGuildRankChangedEvent,
  emitGuildUpdatedEvent,
  broadcastPresenceIfAvailable,
  buildGuildListResponse,
  buildGuildDetailResponse,
  buildGuildRanksResponse,
  buildGuildCreateResponse,
  buildGuildJoinSuccessResponse,
} = require('../domain/guild/guildRouteRuntime');
const {
  attachGuildMemberRoutes,
  attachGuildRankRoutes,
  attachGuildMotdRoutes,
} = require('./guildAdminRoutes');
const {
  attachGuildCrudRoutes,
} = require('./guildCrudRoutes');
const {
  attachGuildLifecycleRoutes,
} = require('./guildLifecycleRoutes');

const router = express.Router();
router.use(auth);

function emitToGuildMembers(guildId, event, payload, extraUserIds = []) {
  return emitToGuildMembersRuntime({
    io: router._io,
    guildId,
    event,
    payload,
    extraUserIds,
    listGuildMemberIdsFn: (id) => getGuildMembers.all(id).map((member) => member.id),
  });
}

function getMemberWithPerms(guildId, userId) {
  return buildGuildMemberState(isGuildMember.get(guildId, userId));
}

function hasPermission(member, permKey) {
  return hasGuildPermission(member, permKey);
}

function requireMember(req, res) {
  const member = getMemberWithPerms(req.params.id, req.userId);
  if (!member) {
    res.status(403).json({
      error: 'Not a member of this guild',
      code: ERROR_CODES.NOT_GUILD_MEMBER,
    });
    return null;
  }
  return member;
}

function sendFlowError(res, result) {
  if (!result?.error) return false;
  res.status(result.status || 400).json({ error: result.error });
  return true;
}

attachGuildCrudRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps: {
    db,
    uuidv4,
    createInviteCodeFn: () => crypto.randomBytes(8).toString('hex'),
    getUserGuilds,
    getAllPublicGuilds,
    getGuildById,
    getGuildRanks,
    getGuildMemberCount,
    getUserCreatedGuildCount,
    getGuildMembers,
    isGuildMember,
    buildGuildCreateInput,
    buildGuildUpdateInput,
    resolveGuildSwitchPlan,
    toGuildListEntry,
    buildGuildListResponse,
    buildGuildDetailResponse,
    buildGuildCreateResponse,
    toGuildRankResponse,
    toGuildSelfRank,
    runGuildCreateFlow,
    createGuild,
    createGuildRank,
    addGuildMember,
    createRoom,
    addRoomMember,
    createVoiceChannel,
    removeGuildMember,
    removeUserFromGuildRooms,
    updateGuild,
    emitGuildMemberLeftEvents,
    emitGuildUpdatedEvent,
    broadcastPresenceIfAvailable,
    broadcastPresenceUpdates,
  },
});

attachGuildLifecycleRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps: {
    db,
    getGuildById,
    getGuildByInviteCode,
    isGuildMember,
    getUserGuilds,
    getLowestRank,
    getGuildMembers,
    getGuildRanks,
    getRoomsByGuild,
    getVoiceChannelsByGuild,
    buildGuildJoinPlan,
    runGuildJoinPlan,
    buildGuildLeaveRequest,
    runGuildLeavePlan,
    buildLeadershipTransferPlan,
    buildGuildInviteCodeAccessPlan,
    runGuildDisbandFlow,
    runGuildLeadershipTransferFlow,
    buildGuildJoinSuccessResponse,
    addGuildMember,
    addUserToGuildRooms,
    removeGuildMember,
    removeUserFromGuildRooms,
    updateMemberRank,
    updateGuildInviteCode,
    emitGuildMemberLeftEvents,
    emitGuildMemberJoinedEvent,
    emitGuildDisbandedEvent,
    emitGuildLeadershipTransferredEvent,
    broadcastPresenceIfAvailable,
    broadcastPresenceUpdates,
    destroyLiveVoiceChannel,
    createInviteCodeFn: () => crypto.randomBytes(8).toString('hex'),
    deleteRoomAttachments,
    deleteRoomMessages,
    deleteSenderKeyDistributionsForRoom,
    deleteRoomMembers,
    deleteRoomRow,
    clearChannelVoiceSessions,
    deleteVoiceChannel,
    deleteGuildMembers,
    deleteGuildRanks,
    deleteGuildRow,
  },
});

attachGuildMemberRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps: {
    getGuildMembers,
    buildGuildMembersResponse,
    isGuildMember,
    buildMemberPermissionOverrideUpdate,
    updateMemberPermissionOverrides,
    getGuildRankById,
    buildRankAssignmentPlan,
    updateMemberRank,
    emitGuildRankChangedEvent,
    buildMemberNoteUpdate,
    updatePublicNote,
    updateOfficerNote,
    buildMemberRemovalPlan,
    removeGuildMember,
    removeUserFromGuildRooms,
    emitGuildMemberKickedEvent,
    broadcastPresenceIfAvailable,
    broadcastPresenceUpdates,
  },
});

attachGuildRankRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps: {
    uuidv4,
    db,
    getGuildRanks,
    toGuildRankResponse,
    buildGuildRanksResponse,
    buildRankCreateInput,
    getLowestRank,
    createGuildRank,
    getGuildRankById,
    buildRankUpdateInput,
    updateGuildRank,
    buildRankDeletionPlan,
    runGuildRankDeletionFlow,
    deleteGuildRank,
  },
});

attachGuildMotdRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps: {
    getGuildById,
    buildMotdUpdate,
    updateGuildMotd,
    emitGuildMotdUpdatedEvent,
    getGuildMembers,
  },
});

module.exports = router;
