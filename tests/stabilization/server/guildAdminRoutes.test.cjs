const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachGuildMemberRoutes,
  attachGuildRankRoutes,
  attachGuildMotdRoutes,
} = require('../../../server/src/routes/guildAdminRoutes');

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

test('guild admin routes register canonical member, rank, and motd paths', () => {
  const { router, routes } = createFakeRouter();
  const noop = () => {};
  const deps = {
    getGuildMembers: { all: () => [] },
    buildGuildMembersResponse: () => ({}),
    isGuildMember: { get: () => null },
    buildMemberPermissionOverrideUpdate: () => ({ normalizedOverrides: {} }),
    updateMemberPermissionOverrides: { run: noop },
    getGuildRankById: { get: () => null },
    buildRankAssignmentPlan: () => ({ rankName: 'Member' }),
    updateMemberRank: { run: noop },
    emitGuildRankChangedEvent: noop,
    buildMemberNoteUpdate: () => ({}),
    updatePublicNote: { run: noop },
    updateOfficerNote: { run: noop },
    buildMemberRemovalPlan: () => ({}),
    removeGuildMember: { run: noop },
    removeUserFromGuildRooms: noop,
    emitGuildMemberKickedEvent: noop,
    broadcastPresenceIfAvailable: noop,
    broadcastPresenceUpdates: noop,
    uuidv4: () => 'uuid',
    db: {},
    getGuildRanks: { all: () => [] },
    toGuildRankResponse: noop,
    buildGuildRanksResponse: () => [],
    buildRankCreateInput: () => ({ name: 'Officer', rankOrder: 1, permissions: {} }),
    getLowestRank: { get: () => ({ rank_order: 2 }) },
    createGuildRank: { run: noop },
    buildRankUpdateInput: () => ({ name: 'Officer', permissions: {} }),
    updateGuildRank: { run: noop },
    buildRankDeletionPlan: () => ({ reassignTo: { id: 'rank-1', name: 'Member' } }),
    runGuildRankDeletionFlow: noop,
    deleteGuildRank: { run: noop },
    getGuildById: { get: () => ({ motd: 'hello' }) },
    buildMotdUpdate: () => ({ motd: 'hello' }),
    updateGuildMotd: { run: noop },
    emitGuildMotdUpdatedEvent: noop,
  };

  attachGuildMemberRoutes({
    router,
    requireMember: () => ({ rank_order: 0 }),
    hasPermission: () => true,
    sendFlowError: () => false,
    deps,
  });
  attachGuildRankRoutes({
    router,
    requireMember: () => ({ rank_order: 0 }),
    hasPermission: () => true,
    sendFlowError: () => false,
    deps,
  });
  attachGuildMotdRoutes({
    router,
    requireMember: () => ({ rank_order: 0 }),
    hasPermission: () => true,
    sendFlowError: () => false,
    deps,
  });

  assert.deepEqual(
    routes.map(({ method, path }) => [method, path]),
    [
      ['get', '/:id/members'],
      ['put', '/:id/members/:userId/permissions'],
      ['put', '/:id/members/:userId/rank'],
      ['put', '/:id/members/:userId/note'],
      ['delete', '/:id/members/:userId'],
      ['get', '/:id/ranks'],
      ['post', '/:id/ranks'],
      ['put', '/:id/ranks/:rankId'],
      ['delete', '/:id/ranks/:rankId'],
      ['get', '/:id/motd'],
      ['put', '/:id/motd'],
    ],
  );
});
