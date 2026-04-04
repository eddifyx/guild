const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachGuildCrudRoutes,
} = require('../../../server/src/routes/guildCrudRoutes');

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

test('guild crud routes register canonical list, create, detail, and update paths', () => {
  const { router, routes } = createFakeRouter();
  const noop = () => {};

  attachGuildCrudRoutes({
    router,
    requireMember: () => ({ rank_order: 0 }),
    hasPermission: () => true,
    sendFlowError: () => false,
    deps: {
      db: {},
      uuidv4: () => 'uuid',
      createInviteCodeFn: () => 'invite-code',
      getUserGuilds: { all: () => [] },
      getAllPublicGuilds: { all: () => [] },
      getGuildById: { get: () => ({ id: 'guild-1' }) },
      getGuildRanks: { all: () => [] },
      getGuildMemberCount: { get: () => ({ count: 1 }) },
      getUserCreatedGuildCount: { get: () => ({ count: 0 }) },
      getGuildMembers: { all: () => [] },
      isGuildMember: { get: () => null },
      buildGuildCreateInput: () => ({ name: 'Guild' }),
      buildGuildUpdateInput: () => ({ name: 'Guild', description: '', imageUrl: '', bannerUrl: '', accentColor: '', backgroundColor: '', isPublic: true }),
      resolveGuildSwitchPlan: () => ({ guilds: [] }),
      toGuildListEntry: noop,
      buildGuildListResponse: () => [],
      buildGuildDetailResponse: () => ({}),
      buildGuildCreateResponse: () => ({ id: 'guild-1' }),
      toGuildRankResponse: noop,
      toGuildSelfRank: noop,
      runGuildCreateFlow: noop,
      createGuild: { run: noop },
      createGuildRank: { run: noop },
      addGuildMember: { run: noop },
      createRoom: { run: noop },
      addRoomMember: { run: noop },
      createVoiceChannel: { run: noop },
      removeGuildMember: { run: noop },
      removeUserFromGuildRooms: noop,
      updateGuild: { run: noop },
      emitGuildMemberLeftEvents: noop,
      emitGuildUpdatedEvent: noop,
      broadcastPresenceIfAvailable: noop,
      broadcastPresenceUpdates: noop,
    },
  });

  assert.deepEqual(
    routes.map(({ method, path }) => [method, path]),
    [
      ['get', '/'],
      ['get', '/public'],
      ['post', '/'],
      ['get', '/:id'],
      ['put', '/:id'],
    ],
  );
});
