const test = require('node:test');
const assert = require('node:assert/strict');

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
} = require('../../../server/src/domain/guild/guildRouteRuntime');

test('guild route runtime emits canonical member-targeted guild events', () => {
  const emitted = [];
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emitted.push([room, event, payload]);
        },
      };
    },
  };
  const listGuildMemberIdsFn = (guildId) => guildId === 'guild-1' ? ['user-1', 'user-2'] : [];

  assert.deepEqual(
    emitToGuildMembersRuntime({
      io,
      guildId: 'guild-1',
      event: 'guild:updated',
      payload: { guildId: 'guild-1' },
      extraUserIds: ['user-2', 'user-3'],
      listGuildMemberIdsFn,
    }).sort(),
    ['user-1', 'user-2', 'user-3'],
  );

  emitGuildMemberLeftEvents({ io, guildIds: ['guild-1'], userId: 'user-9', listGuildMemberIdsFn });
  emitGuildMemberJoinedEvent({ io, guildId: 'guild-1', userId: 'user-9', listGuildMemberIdsFn });
  emitGuildMemberKickedEvent({ io, guildId: 'guild-1', userId: 'user-8', listGuildMemberIdsFn });
  emitGuildLeadershipTransferredEvent({ io, guildId: 'guild-1', newLeaderId: 'user-7', listGuildMemberIdsFn });
  emitGuildMotdUpdatedEvent({ io, guildId: 'guild-1', motd: 'hello', listGuildMemberIdsFn });
  emitGuildRankChangedEvent({
    io,
    guildId: 'guild-1',
    userId: 'user-6',
    rankId: 'rank-1',
    rankName: 'Officer',
    listGuildMemberIdsFn,
  });
  emitGuildUpdatedEvent({ io, guildId: 'guild-1', listGuildMemberIdsFn });
  emitGuildDisbandedEvent({ io, guildId: 'guild-1', memberIds: ['user-1', 'user-2'] });

  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:member_left' && payload.userId === 'user-9'),
    true,
  );
  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:member_joined' && payload.userId === 'user-9'),
    true,
  );
  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:member_kicked' && payload.userId === 'user-8'),
    true,
  );
  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:leadership_transferred' && payload.newLeaderId === 'user-7'),
    true,
  );
  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:motd_updated' && payload.motd === 'hello'),
    true,
  );
  assert.equal(
    emitted.some(([, event, payload]) => event === 'guild:member_rank_changed' && payload.rankName === 'Officer'),
    true,
  );
  assert.equal(
    emitted.some(([, event]) => event === 'guild:updated'),
    true,
  );
  assert.equal(
    emitted.some(([, event]) => event === 'guild:disbanded'),
    true,
  );
});

test('guild route runtime centralizes presence-safe no-op behavior and response shaping', () => {
  const presenceCalls = [];
  broadcastPresenceIfAvailable({
    io: null,
    broadcastPresenceUpdatesFn: () => presenceCalls.push('nope'),
  });
  broadcastPresenceIfAvailable({
    io: {},
    broadcastPresenceUpdatesFn: () => presenceCalls.push('ok'),
  });
  assert.deepEqual(presenceCalls, ['ok']);

  const listResponse = buildGuildListResponse({
    guilds: [{ id: 'guild-1', name: 'Guild One' }],
    getGuildMemberCountFn: () => ({ count: 3 }),
    toGuildListEntryFn: (guild, count, options) => ({ guild, count, options }),
    hideRawPermissions: false,
  });
  assert.deepEqual(listResponse, [{
    guild: { id: 'guild-1', name: 'Guild One' },
    count: 3,
    options: { hideRawPermissions: false },
  }]);

  const detailResponse = buildGuildDetailResponse({
    guild: { id: 'guild-1', name: 'Guild One' },
    member: { capabilities: { canInviteMember: true }, rank_order: 0 },
    ranks: [{ id: 'rank-1', name: 'Officer' }],
    memberCount: 9,
    toGuildRankResponseFn: (rank) => ({ rankId: rank.id, label: rank.name }),
    toGuildSelfRankFn: () => ({ rankOrder: 0 }),
  });
  assert.deepEqual(detailResponse, {
    id: 'guild-1',
    name: 'Guild One',
    ranks: [{ rankId: 'rank-1', label: 'Officer' }],
    memberCount: 9,
    capabilities: { canInviteMember: true },
    myRank: { rankOrder: 0 },
  });

  assert.deepEqual(
    buildGuildRanksResponse({
      ranks: [{ id: 'rank-1', name: 'Officer' }],
      toGuildRankResponseFn: (rank) => ({ rankId: rank.id, label: rank.name }),
    }),
    [{ rankId: 'rank-1', label: 'Officer' }],
  );

  assert.deepEqual(
    buildGuildCreateResponse({ guild: { id: 'guild-1' }, memberCount: 1 }),
    { id: 'guild-1', memberCount: 1 },
  );
  assert.deepEqual(
    buildGuildJoinSuccessResponse({ guildId: 'guild-1', guildName: 'Guild One' }),
    { ok: true, guildId: 'guild-1', guildName: 'Guild One' },
  );
});
