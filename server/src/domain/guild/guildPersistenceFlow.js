const { buildDefaultGuildRankRows } = require('./rankPolicy');
const { applyGuildLeavePlan } = require('./guildManagementFlow');

function runGuildCreateFlow({
  db,
  guildId,
  inviteCode,
  userId,
  createInput,
  guildsToLeave = [],
  createIdFn = () => '',
  createGuild,
  createGuildRank,
  addGuildMember,
  createRoom,
  addRoomMember,
  createVoiceChannel,
  removeGuildMember,
  removeUserFromGuildRooms,
} = {}) {
  const createGuildWithDefaults = db.transaction(() => {
    applyGuildLeavePlan({
      userId,
      guilds: guildsToLeave,
      removeGuildMember,
      removeUserFromGuildRooms,
    });

    createGuild.run(
      guildId,
      createInput.name,
      createInput.description,
      createInput.imageUrl,
      '',
      '#40FF40',
      '#080a08',
      userId,
      createInput.isPublic ? 1 : 0,
      inviteCode,
    );

    let guildMasterRankId = null;
    for (const rankRow of buildDefaultGuildRankRows(guildId)) {
      createGuildRank.run(
        rankRow.id,
        rankRow.guildId,
        rankRow.name,
        rankRow.rankOrder,
        rankRow.permissions,
      );
      if (rankRow.rankOrder === 0) guildMasterRankId = rankRow.id;
    }

    addGuildMember.run(guildId, userId, guildMasterRankId);

    const roomId = createIdFn();
    createRoom.run(roomId, 'General', guildId, userId);
    addRoomMember.run(roomId, userId);

    const voiceChannelId = createIdFn();
    createVoiceChannel.run(voiceChannelId, 'General', guildId, userId);
  });

  createGuildWithDefaults();
}

function runGuildDisbandFlow({
  db,
  guildId,
  getGuildMembers,
  getRoomsByGuild,
  getVoiceChannelsByGuild,
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
} = {}) {
  const memberIds = getGuildMembers.all(guildId).map((member) => member.id);
  const voiceChannelIds = getVoiceChannelsByGuild.all(guildId).map((channel) => channel.id);

  const disbandGuild = db.transaction((nextGuildId) => {
    const rooms = getRoomsByGuild.all(nextGuildId);
    for (const room of rooms) {
      deleteRoomAttachments.run(room.id);
      deleteRoomMessages.run(room.id);
      deleteSenderKeyDistributionsForRoom.run(room.id);
      deleteRoomMembers.run(room.id);
      deleteRoomRow.run(room.id);
    }

    const voiceChannels = getVoiceChannelsByGuild.all(nextGuildId);
    for (const voiceChannel of voiceChannels) {
      clearChannelVoiceSessions.run(voiceChannel.id);
      deleteVoiceChannel.run(voiceChannel.id);
    }

    deleteGuildMembers.run(nextGuildId);
    deleteGuildRanks.run(nextGuildId);
    deleteGuildRow.run(nextGuildId);
  });

  disbandGuild(guildId);
  return { memberIds, voiceChannelIds };
}

function runGuildLeadershipTransferFlow({
  db,
  guildId,
  actorUserId,
  newLeaderId,
  guildMasterRankId,
  demotedRankId,
  updateMemberRank,
} = {}) {
  const transferLeadership = db.transaction(() => {
    updateMemberRank.run(guildMasterRankId, guildId, newLeaderId);
    updateMemberRank.run(demotedRankId, guildId, actorUserId);
  });

  transferLeadership();
}

function runGuildRankDeletionFlow({
  db,
  guildId,
  rankId,
  reassignToRankId,
  deleteGuildRank,
} = {}) {
  const deleteRankTx = db.transaction(() => {
    db.prepare('UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND rank_id = ?')
      .run(reassignToRankId, guildId, rankId);
    deleteGuildRank.run(rankId);
  });

  deleteRankTx();
}

module.exports = {
  runGuildCreateFlow,
  runGuildDisbandFlow,
  runGuildLeadershipTransferFlow,
  runGuildRankDeletionFlow,
};
