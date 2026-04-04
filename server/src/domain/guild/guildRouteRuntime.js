function emitToGuildMembersRuntime({
  io,
  guildId,
  event,
  payload,
  extraUserIds = [],
  listGuildMemberIdsFn,
}) {
  if (!io || !guildId) return [];

  const targetUserIds = new Set([
    ...(listGuildMemberIdsFn?.(guildId) || []),
    ...extraUserIds.filter(Boolean),
  ]);

  for (const userId of targetUserIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  return [...targetUserIds];
}

function emitGuildMemberLeftEvents({
  io,
  guildIds,
  userId,
  listGuildMemberIdsFn,
}) {
  for (const guildId of guildIds || []) {
    emitToGuildMembersRuntime({
      io,
      guildId,
      event: 'guild:member_left',
      payload: { guildId, userId },
      listGuildMemberIdsFn,
    });
  }
}

function emitGuildMemberJoinedEvent({
  io,
  guildId,
  userId,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:member_joined',
    payload: { guildId, userId },
    listGuildMemberIdsFn,
  });
}

function emitGuildMemberKickedEvent({
  io,
  guildId,
  userId,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:member_kicked',
    payload: { guildId, userId },
    extraUserIds: [userId],
    listGuildMemberIdsFn,
  });
}

function emitGuildDisbandedEvent({
  io,
  guildId,
  memberIds,
}) {
  if (!io) return;
  for (const userId of memberIds || []) {
    io.to(`user:${userId}`).emit('guild:disbanded', { guildId });
  }
}

function emitGuildLeadershipTransferredEvent({
  io,
  guildId,
  newLeaderId,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:leadership_transferred',
    payload: { guildId, newLeaderId },
    listGuildMemberIdsFn,
  });
}

function emitGuildMotdUpdatedEvent({
  io,
  guildId,
  motd,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:motd_updated',
    payload: { guildId, motd },
    listGuildMemberIdsFn,
  });
}

function emitGuildRankChangedEvent({
  io,
  guildId,
  userId,
  rankId,
  rankName,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:member_rank_changed',
    payload: { guildId, userId, rankId, rankName },
    listGuildMemberIdsFn,
  });
}

function emitGuildUpdatedEvent({
  io,
  guildId,
  listGuildMemberIdsFn,
}) {
  emitToGuildMembersRuntime({
    io,
    guildId,
    event: 'guild:updated',
    payload: { guildId },
    listGuildMemberIdsFn,
  });
}

function broadcastPresenceIfAvailable({
  io,
  broadcastPresenceUpdatesFn,
}) {
  if (io) {
    broadcastPresenceUpdatesFn?.(io);
  }
}

function buildGuildListResponse({
  guilds,
  getGuildMemberCountFn,
  toGuildListEntryFn,
  hideRawPermissions = true,
}) {
  return guilds.map((guild) => (
    toGuildListEntryFn(guild, getGuildMemberCountFn(guild.id).count, {
      hideRawPermissions,
    })
  ));
}

function buildGuildDetailResponse({
  guild,
  member,
  ranks,
  memberCount,
  toGuildRankResponseFn,
  toGuildSelfRankFn,
}) {
  return {
    ...guild,
    ranks: ranks.map((rank) => toGuildRankResponseFn(rank)),
    memberCount,
    capabilities: member.capabilities,
    myRank: toGuildSelfRankFn(member),
  };
}

function buildGuildRanksResponse({
  ranks,
  toGuildRankResponseFn,
}) {
  return ranks.map((rank) => ({
    ...toGuildRankResponseFn(rank),
  }));
}

function buildGuildCreateResponse({ guild, memberCount = 1 }) {
  return {
    ...guild,
    memberCount,
  };
}

function buildGuildJoinSuccessResponse({ guildId, guildName }) {
  return { ok: true, guildId, guildName };
}

module.exports = {
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
};
