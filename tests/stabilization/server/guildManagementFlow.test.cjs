const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyGuildLeavePlan,
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
  sanitizeGuildAssetUrl,
  toGuildListEntry,
} = require('../../../server/src/domain/guild/guildManagementFlow');

test('guild management flow sanitizes guild asset urls and hides raw permissions in list entries', () => {
  assert.equal(sanitizeGuildAssetUrl('https://cdn.guild.test/banner.png'), 'https://cdn.guild.test/banner.png');
  assert.equal(sanitizeGuildAssetUrl('/uploads/abc123.png'), '/uploads/abc123.png');
  assert.equal(sanitizeGuildAssetUrl('javascript:alert(1)'), '');

  assert.deepEqual(
    toGuildListEntry({ id: 'guild-1', name: 'Guild', permissions: '{"invite_member":true}' }, 7),
    {
      id: 'guild-1',
      name: 'Guild',
      permissions: undefined,
      memberCount: 7,
    }
  );
});

test('guild management flow builds guild create and update inputs with validation and sanitization', () => {
  assert.deepEqual(
    buildGuildCreateInput({
      name: '  Builders  ',
      description: 'hello',
      image_url: 'https://cdn.guild.test/icon.png',
      is_public: 1,
    }),
    {
      name: 'Builders',
      description: 'hello',
      imageUrl: 'https://cdn.guild.test/icon.png',
      isPublic: true,
    }
  );

  assert.deepEqual(
    buildGuildCreateInput({ name: '   ' }),
    { status: 400, error: 'Guild name is required' }
  );

  assert.deepEqual(
    buildGuildUpdateInput({
      guild: {
        name: 'Old Name',
        description: 'old',
        image_url: '/uploads/old.png',
        banner_url: '',
        accent_color: '#00ff00',
        bg_color: '#000000',
        is_public: 0,
      },
      input: {
        name: '  New Name ',
        image_url: 'data:text/plain,bad',
        banner_url: 'https://cdn.guild.test/banner.png',
        is_public: true,
      },
    }),
    {
      name: 'New Name',
      description: 'old',
      imageUrl: '',
      bannerUrl: 'https://cdn.guild.test/banner.png',
      accentColor: '#00ff00',
      backgroundColor: '#000000',
      isPublic: true,
    }
  );
});

test('guild management flow blocks switching away while user is still guild master', () => {
  const userGuilds = [{ id: 'guild-a' }, { id: 'guild-b' }];
  const memberships = {
    'guild-a': { rank_order: 3 },
    'guild-b': { rank_order: 0 },
  };

  assert.deepEqual(
    resolveGuildSwitchPlan({
      userGuilds,
      guildMasterError: 'transfer first',
      getMembership: (guildId) => memberships[guildId],
    }),
    { guilds: [], error: 'transfer first' }
  );
});

test('guild management flow applies leave plan across existing guild memberships', () => {
  const removedMembers = [];
  const removedRoomMemberships = [];

  applyGuildLeavePlan({
    userId: 'user-1',
    guilds: [{ id: 'guild-a' }, { id: 'guild-b' }],
    removeGuildMember: {
      run(guildId, userId) {
        removedMembers.push([guildId, userId]);
      },
    },
    removeUserFromGuildRooms(guildId, userId) {
      removedRoomMemberships.push([guildId, userId]);
    },
  });

  assert.deepEqual(removedMembers, [
    ['guild-a', 'user-1'],
    ['guild-b', 'user-1'],
  ]);
  assert.deepEqual(removedRoomMemberships, [
    ['guild-a', 'user-1'],
    ['guild-b', 'user-1'],
  ]);
});

test('guild management flow normalizes per-member permission overrides', () => {
  const result = buildMemberPermissionOverrideUpdate({
    actorMember: { rank_order: 0 },
    actorUserId: 'gm',
    targetUserId: 'member-2',
    targetMember: { id: 'member-2' },
    overrides: {
      invite_member: true,
      guild_chat_speak: false,
      transfer_leadership: true,
      unknown_permission: true,
    },
  });

  assert.deepEqual(result, {
    normalizedOverrides: {
      invite_member: true,
    },
  });
});

test('guild management flow validates leadership transfer and rank assignment rules', () => {
  assert.deepEqual(
    buildLeadershipTransferPlan({
      actorMember: { rank_order: 0 },
      targetUserId: 'member-2',
      targetMember: { id: 'member-2' },
      ranks: [
        { id: 'rank-gm', rank_order: 0 },
        { id: 'rank-officer', rank_order: 1 },
      ],
    }),
    {
      guildMasterRankId: 'rank-gm',
      demotedRankId: 'rank-officer',
      newLeaderId: 'member-2',
    }
  );

  assert.deepEqual(
    buildRankAssignmentPlan({
      actorMember: { rank_order: 1 },
      canPromoteDemote: true,
      targetMember: { rank_order: 3 },
      rankId: 'rank-veteran',
      newRank: { guild_id: 'guild-1', rank_order: 2, name: 'Veteran' },
      guildId: 'guild-1',
    }),
    {
      rankId: 'rank-veteran',
      rankName: 'Veteran',
    }
  );

  assert.deepEqual(
    buildRankAssignmentPlan({
      actorMember: { rank_order: 2 },
      canPromoteDemote: true,
      targetMember: { rank_order: 3 },
      rankId: 'rank-officer',
      newRank: { guild_id: 'guild-1', rank_order: 1, name: 'Officer' },
      guildId: 'guild-1',
    }),
    { status: 403, error: 'Cannot promote someone to your rank or above' }
  );
});

test('guild management flow enforces note and removal permissions', () => {
  assert.deepEqual(
    buildMemberNoteUpdate({
      actorUserId: 'user-1',
      targetUserId: 'user-2',
      publicNote: 'hello',
      canEditPublicNote: false,
      canEditOfficerNote: false,
    }),
    { status: 403, error: 'No permission to edit public notes' }
  );

  assert.deepEqual(
    buildMemberNoteUpdate({
      actorUserId: 'user-1',
      targetUserId: 'user-1',
      publicNote: 'hello',
      officerNote: 'internal',
      canEditPublicNote: false,
      canEditOfficerNote: true,
    }),
    { publicNote: 'hello', officerNote: 'internal' }
  );

  assert.deepEqual(
    buildMemberRemovalPlan({
      actorMember: { rank_order: 2 },
      canRemoveMember: true,
      targetMember: { rank_order: 1 },
    }),
    { status: 403, error: 'Cannot kick someone at or above your rank' }
  );
});

test('guild management flow builds rank create, update, and delete plans', () => {
  assert.deepEqual(
    buildRankCreateInput({
      canSetPermissions: true,
      name: '  Raider ',
      permissions: { invite_member: true, transfer_leadership: true },
      lowestRank: { rank_order: 4 },
      existingRanksCount: 5,
    }),
    {
      name: 'Raider',
      rankOrder: 5,
      permissions: {
        invite_member: true,
        guild_chat_speak: true,
        guild_chat_listen: true,
      },
    }
  );

  assert.deepEqual(
    buildRankUpdateInput({
      actorMember: { rank_order: 1 },
      rank: {
        guild_id: 'guild-1',
        rank_order: 2,
        name: 'Veteran',
        permissions: '{"invite_member":true}',
      },
      guildId: 'guild-1',
      name: '  Elder Veteran  ',
      permissions: { remove_member: true, disband_guild: true },
      canRenameRanks: true,
      canSetPermissions: true,
    }),
    {
      name: 'Elder Veteran',
      permissions: {
        remove_member: true,
        guild_chat_speak: true,
        guild_chat_listen: true,
      },
    }
  );

  assert.deepEqual(
    buildRankDeletionPlan({
      actorMember: { rank_order: 1 },
      canSetPermissions: true,
      rank: { id: 'rank-veteran', guild_id: 'guild-1', rank_order: 2 },
      guildId: 'guild-1',
      allRanks: [
        { id: 'rank-gm', rank_order: 0, name: 'Guild Master' },
        { id: 'rank-officer', rank_order: 1, name: 'Officer' },
        { id: 'rank-veteran', rank_order: 2, name: 'Veteran' },
        { id: 'rank-member', rank_order: 3, name: 'Member' },
      ],
    }),
    {
      reassignTo: { id: 'rank-member', rank_order: 3, name: 'Member' },
    }
  );
});

test('guild management flow normalizes motd updates', () => {
  assert.deepEqual(
    buildMotdUpdate({ canModifyMotd: true, motd: 'Welcome' }),
    { motd: 'Welcome' }
  );

  assert.deepEqual(
    buildMotdUpdate({ canModifyMotd: false, motd: 'Welcome' }),
    { status: 403, error: 'No permission to modify Message of the Day' }
  );
});
