const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildGuildMemberPermissionUpdateResponse,
  buildGuildRankCreateResponse,
  buildGuildAdminOkResponse,
  buildGuildMotdResponse,
} = require('../../../server/src/domain/guild/guildAdminRouteRuntime');

test('guild admin route runtime builds canonical permission, rank, and motd responses', () => {
  assert.deepEqual(
    buildGuildMemberPermissionUpdateResponse({ overrides: { invite_member: true } }),
    { success: true, overrides: { invite_member: true } },
  );

  assert.deepEqual(
    buildGuildRankCreateResponse({
      rankId: 'rank-1',
      name: 'Officer',
      rankOrder: 1,
      permissions: { invite_member: true },
    }),
    {
      id: 'rank-1',
      name: 'Officer',
      rank_order: 1,
      permissions: { invite_member: true },
    },
  );

  assert.deepEqual(
    buildGuildAdminOkResponse(),
    { ok: true },
  );
  assert.deepEqual(
    buildGuildAdminOkResponse({ reassignedTo: 'Member' }),
    { ok: true, reassignedTo: 'Member' },
  );
  assert.deepEqual(
    buildGuildMotdResponse({ motd: '' }),
    { motd: '' },
  );
});
