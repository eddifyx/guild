const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildGuildInviteCodeAccessPlan,
  buildGuildJoinPlan,
  buildGuildLeaveRequest,
  buildGuildMembersResponse,
  runGuildJoinPlan,
  runGuildLeavePlan,
} = require('../../../server/src/domain/guild/guildMembershipFlow');

test('guild membership flow validates public and invite joins through one shared plan', () => {
  assert.deepEqual(
    buildGuildJoinPlan({
      guild: null,
      notFoundError: 'Invalid invite code',
    }),
    { status: 404, error: 'Invalid invite code' }
  );

  assert.deepEqual(
    buildGuildJoinPlan({
      guild: { id: 'guild-1', is_public: 0 },
      requirePublic: true,
      currentGuilds: [],
      guildMasterError: 'transfer first',
      getMembership: () => null,
      lowestRank: { id: 'rank-initiate' },
    }),
    { status: 403, error: 'This guild is invite-only' }
  );

  assert.deepEqual(
    buildGuildJoinPlan({
      guild: { id: 'guild-1', name: 'Guild One', is_public: 1 },
      existingMembership: { guild_id: 'guild-1' },
      currentGuilds: [],
      guildMasterError: 'transfer first',
      getMembership: () => null,
      lowestRank: { id: 'rank-initiate' },
      requirePublic: true,
    }),
    { status: 409, error: 'Already a member' }
  );

  assert.deepEqual(
    buildGuildJoinPlan({
      guild: { id: 'guild-1', name: 'Guild One', is_public: 1 },
      currentGuilds: [{ id: 'guild-old' }],
      guildMasterError: 'transfer first',
      getMembership: () => ({ rank_order: 0 }),
      lowestRank: { id: 'rank-initiate' },
      requirePublic: true,
    }),
    { status: 403, error: 'transfer first' }
  );

  assert.deepEqual(
    buildGuildJoinPlan({
      guild: { id: 'guild-1', name: 'Guild One', is_public: 1 },
      currentGuilds: [{ id: 'guild-old' }],
      guildMasterError: 'transfer first',
      getMembership: () => ({ rank_order: 3 }),
      lowestRank: { id: 'rank-initiate' },
      requirePublic: true,
    }),
    {
      guildId: 'guild-1',
      guildName: 'Guild One',
      guildsToLeave: [{ id: 'guild-old' }],
      lowestRankId: 'rank-initiate',
    }
  );
});

test('guild membership flow runs join and leave plans through the shared membership transition helpers', () => {
  const joinCalls = [];
  const leaveCalls = [];

  runGuildJoinPlan({
    db: {
      transaction(fn) {
        return () => fn();
      },
    },
    plan: {
      guildId: 'guild-new',
      guildsToLeave: [{ id: 'guild-old' }],
      lowestRankId: 'rank-initiate',
    },
    userId: 'user-1',
    addGuildMember: {
      run(guildId, userId, rankId) {
        joinCalls.push(['member', guildId, userId, rankId]);
      },
    },
    addUserToGuildRooms(guildId, userId) {
      joinCalls.push(['rooms', guildId, userId]);
    },
    removeGuildMember: {
      run(guildId, userId) {
        leaveCalls.push(['member', guildId, userId]);
      },
    },
    removeUserFromGuildRooms(guildId, userId) {
      leaveCalls.push(['rooms', guildId, userId]);
    },
  });

  assert.deepEqual(leaveCalls, [
    ['member', 'guild-old', 'user-1'],
    ['rooms', 'guild-old', 'user-1'],
  ]);
  assert.deepEqual(joinCalls, [
    ['member', 'guild-new', 'user-1', 'rank-initiate'],
    ['rooms', 'guild-new', 'user-1'],
  ]);

  assert.deepEqual(
    buildGuildLeaveRequest({ member: { rank_order: 0 } }),
    { status: 403, error: 'Guild Master must transfer leadership before leaving' }
  );

  assert.deepEqual(buildGuildLeaveRequest({ member: { rank_order: 3 } }), { ok: true });

  const leavePlanCalls = [];
  runGuildLeavePlan({
    guildId: 'guild-new',
    userId: 'user-1',
    removeGuildMember: {
      run(guildId, userId) {
        leavePlanCalls.push(['member', guildId, userId]);
      },
    },
    removeUserFromGuildRooms(guildId, userId) {
      leavePlanCalls.push(['rooms', guildId, userId]);
    },
  });

  assert.deepEqual(leavePlanCalls, [
    ['member', 'guild-new', 'user-1'],
    ['rooms', 'guild-new', 'user-1'],
  ]);
});

test('guild membership flow centralizes invite access and member list shaping', () => {
  assert.deepEqual(
    buildGuildInviteCodeAccessPlan({ canInvite: false }),
    { status: 403, error: 'No permission to invite members' }
  );
  assert.deepEqual(
    buildGuildInviteCodeAccessPlan({ canInvite: false, deniedError: 'No permission to manage invites' }),
    { status: 403, error: 'No permission to manage invites' }
  );
  assert.deepEqual(buildGuildInviteCodeAccessPlan({ canInvite: true }), { ok: true });

  assert.deepEqual(
    buildGuildMembersResponse({
      members: [{
        id: 'user-1',
        username: 'Builder',
        npub: 'npub1builder',
        avatar_color: '#00ff00',
        profile_picture: '/uploads/avatar.png',
        rank_id: 'rank-initiate',
        officer_note: 'internal',
        public_note: 'hello',
        permissions: '{}',
        permission_overrides: '{}',
        rank_order: 3,
        rank_name: 'Initiate',
        joined_at: 123,
        last_seen: 456,
      }],
      includeOfficerNote: false,
    }),
    [{
      id: 'user-1',
      username: 'Builder',
      npub: 'npub1builder',
      avatarColor: '#00ff00',
      profilePicture: '/uploads/avatar.png',
      rankId: 'rank-initiate',
      rankName: 'Initiate',
      rankOrder: 3,
      permissions: {
        guild_chat_speak: true,
        guild_chat_listen: true,
      },
      effectivePermissions: {
        guild_chat_speak: true,
        guild_chat_listen: true,
      },
      capabilities: {
        isGuildMaster: false,
        canListenGuildChat: true,
        canSpeakGuildChat: true,
        canInviteMember: false,
        canRemoveMember: false,
        canPromoteDemote: false,
        canModifyMotd: false,
        canManageTheme: false,
        canManageRooms: false,
        canSetPermissions: false,
        effectivePermissions: {
          guild_chat_speak: true,
          guild_chat_listen: true,
        },
      },
      publicNote: 'hello',
      officerNote: undefined,
      permissionOverrides: {},
      joinedAt: 123,
      lastSeen: 456,
    }]
  );
});
