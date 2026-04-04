function attachGuildLifecycleRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps = {},
} = {}) {
  const {
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
    createInviteCodeFn = () => '',
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
  } = deps;

  router.delete('/:id', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    if (member.rank_order !== 0) {
      return res.status(403).json({ error: 'Only the Guild Master can disband the guild' });
    }

    const { memberIds, voiceChannelIds } = runGuildDisbandFlow({
      db,
      guildId: req.params.id,
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
    });
    for (const voiceChannelId of voiceChannelIds) {
      destroyLiveVoiceChannel(router._io, voiceChannelId, 'guild-disbanded');
    }

    emitGuildDisbandedEvent({
      io: router._io,
      guildId: req.params.id,
      memberIds,
    });
    broadcastPresenceIfAvailable({
      io: router._io,
      broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
    });
    res.json({ ok: true });
  });

  router.post('/:id/join', (req, res) => {
    const joinPlan = buildGuildJoinPlan({
      guild: getGuildById.get(req.params.id),
      existingMembership: isGuildMember.get(req.params.id, req.userId),
      currentGuilds: getUserGuilds.all(req.userId),
      guildMasterError: 'You must transfer Guild Master or disband your current guild before switching guilds',
      getMembership: (guildId) => isGuildMember.get(guildId, req.userId),
      lowestRank: getLowestRank.get(req.params.id),
      requirePublic: true,
    });
    if (sendFlowError(res, joinPlan)) return;

    runGuildJoinPlan({
      db,
      plan: joinPlan,
      userId: req.userId,
      addGuildMember,
      addUserToGuildRooms,
      removeGuildMember,
      removeUserFromGuildRooms,
    });

    emitGuildMemberLeftEvents({
      io: router._io,
      guildIds: joinPlan.guildsToLeave.map((guild) => guild.id),
      userId: req.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    emitGuildMemberJoinedEvent({
      io: router._io,
      guildId: req.params.id,
      userId: req.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    broadcastPresenceIfAvailable({
      io: router._io,
      broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
    });
    res.json({ ok: true });
  });

  router.post('/join/:inviteCode', (req, res) => {
    const guild = getGuildByInviteCode.get(req.params.inviteCode);
    const joinPlan = buildGuildJoinPlan({
      guild,
      existingMembership: guild ? isGuildMember.get(guild.id, req.userId) : null,
      currentGuilds: getUserGuilds.all(req.userId),
      guildMasterError: 'You must transfer Guild Master or disband your current guild before switching guilds',
      getMembership: (guildId) => isGuildMember.get(guildId, req.userId),
      lowestRank: guild ? getLowestRank.get(guild.id) : null,
      notFoundError: 'Invalid invite code',
    });
    if (sendFlowError(res, joinPlan)) return;

    runGuildJoinPlan({
      db,
      plan: joinPlan,
      userId: req.userId,
      addGuildMember,
      addUserToGuildRooms,
      removeGuildMember,
      removeUserFromGuildRooms,
    });

    emitGuildMemberLeftEvents({
      io: router._io,
      guildIds: joinPlan.guildsToLeave.map((guild) => guild.id),
      userId: req.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    emitGuildMemberJoinedEvent({
      io: router._io,
      guildId: joinPlan.guildId,
      userId: req.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    broadcastPresenceIfAvailable({
      io: router._io,
      broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
    });
    res.json(buildGuildJoinSuccessResponse({
      guildId: joinPlan.guildId,
      guildName: joinPlan.guildName,
    }));
  });

  router.post('/:id/leave', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const leaveRequest = buildGuildLeaveRequest({ member });
    if (sendFlowError(res, leaveRequest)) return;

    runGuildLeavePlan({
      guildId: req.params.id,
      userId: req.userId,
      removeGuildMember,
      removeUserFromGuildRooms,
    });

    emitGuildMemberLeftEvents({
      io: router._io,
      guildIds: [req.params.id],
      userId: req.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    broadcastPresenceIfAvailable({
      io: router._io,
      broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
    });
    res.json({ ok: true });
  });

  router.post('/:id/transfer', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const { targetUserId } = req.body;
    const target = isGuildMember.get(req.params.id, targetUserId);
    const transferPlan = buildLeadershipTransferPlan({
      actorMember: member,
      targetUserId,
      targetMember: target,
      ranks: getGuildRanks.all(req.params.id),
    });
    if (sendFlowError(res, transferPlan)) return;

    runGuildLeadershipTransferFlow({
      db,
      guildId: req.params.id,
      actorUserId: req.userId,
      newLeaderId: targetUserId,
      guildMasterRankId: transferPlan.guildMasterRankId,
      demotedRankId: transferPlan.demotedRankId,
      updateMemberRank,
    });

    emitGuildLeadershipTransferredEvent({
      io: router._io,
      guildId: req.params.id,
      newLeaderId: targetUserId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    res.json({ ok: true });
  });

  router.post('/:id/invite', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    const inviteAccess = buildGuildInviteCodeAccessPlan({
      canInvite: hasPermission(member, 'invite_member'),
    });
    if (sendFlowError(res, inviteAccess)) return;

    const guild = getGuildById.get(req.params.id);
    res.json({ inviteCode: guild.invite_code });
  });

  router.post('/:id/regenerate-invite', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    const inviteAccess = buildGuildInviteCodeAccessPlan({
      canInvite: hasPermission(member, 'invite_member'),
      deniedError: 'No permission to manage invites',
    });
    if (sendFlowError(res, inviteAccess)) return;

    const newCode = createInviteCodeFn();
    updateGuildInviteCode.run(newCode, req.params.id);
    res.json({ inviteCode: newCode });
  });
}

module.exports = {
  attachGuildLifecycleRoutes,
};
