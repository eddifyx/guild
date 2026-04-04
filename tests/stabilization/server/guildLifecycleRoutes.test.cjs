const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachGuildLifecycleRoutes,
} = require('../../../server/src/routes/guildLifecycleRoutes');

function createFakeRouter() {
  const routes = [];
  const router = { _io: null };
  for (const method of ['get', 'post', 'put', 'delete']) {
    router[method] = (path, handler) => {
      routes.push({ method, path, handler });
      return router;
    };
  }
  return { router, routes };
}

test('guild lifecycle routes register canonical disband, membership, and invite paths', () => {
  const { router, routes } = createFakeRouter();
  const noop = () => {};
  const deps = {
    db: {},
    getGuildById: { get: () => ({ invite_code: 'invite-code' }) },
    getGuildByInviteCode: { get: () => null },
    isGuildMember: { get: () => null },
    getUserGuilds: { all: () => [] },
    getLowestRank: { get: () => null },
    getGuildMembers: { all: () => [] },
    getGuildRanks: { all: () => [] },
    getRoomsByGuild: { all: () => [] },
    getVoiceChannelsByGuild: { all: () => [] },
    buildGuildJoinPlan: () => ({ guildsToLeave: [], guildId: 'guild-1', guildName: 'Guild One' }),
    runGuildJoinPlan: noop,
    buildGuildLeaveRequest: () => ({}),
    runGuildLeavePlan: noop,
    buildLeadershipTransferPlan: () => ({ guildMasterRankId: 'rank-1', demotedRankId: 'rank-2' }),
    buildGuildInviteCodeAccessPlan: () => ({}),
    runGuildDisbandFlow: () => ({ memberIds: [], voiceChannelIds: [] }),
    runGuildLeadershipTransferFlow: noop,
    buildGuildJoinSuccessResponse: ({ guildId, guildName }) => ({ guildId, guildName }),
    addGuildMember: { run: noop },
    addUserToGuildRooms: noop,
    removeGuildMember: { run: noop },
    removeUserFromGuildRooms: noop,
    updateMemberRank: { run: noop },
    updateGuildInviteCode: { run: noop },
    emitGuildMemberLeftEvents: noop,
    emitGuildMemberJoinedEvent: noop,
    emitGuildDisbandedEvent: noop,
    emitGuildLeadershipTransferredEvent: noop,
    broadcastPresenceIfAvailable: noop,
    broadcastPresenceUpdates: noop,
    destroyLiveVoiceChannel: noop,
    createInviteCodeFn: () => 'new-invite',
    deleteRoomAttachments: noop,
    deleteRoomMessages: noop,
    deleteSenderKeyDistributionsForRoom: noop,
    deleteRoomMembers: noop,
    deleteRoomRow: noop,
    clearChannelVoiceSessions: noop,
    deleteVoiceChannel: noop,
    deleteGuildMembers: noop,
    deleteGuildRanks: noop,
    deleteGuildRow: noop,
  };

  attachGuildLifecycleRoutes({
    router,
    requireMember: () => ({ rank_order: 0 }),
    hasPermission: () => true,
    sendFlowError: () => false,
    deps,
  });

  assert.deepEqual(
    routes.map(({ method, path }) => [method, path]),
    [
      ['delete', '/:id'],
      ['post', '/:id/join'],
      ['post', '/join/:inviteCode'],
      ['post', '/:id/leave'],
      ['post', '/:id/transfer'],
      ['post', '/:id/invite'],
      ['post', '/:id/regenerate-invite'],
    ],
  );
});
