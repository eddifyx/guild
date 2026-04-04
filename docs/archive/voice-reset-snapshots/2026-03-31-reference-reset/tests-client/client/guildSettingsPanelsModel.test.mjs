import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGuildSettingsOverrideToggle,
  buildGuildSettingsAdminState,
  buildGuildSettingsMemberCountLabel,
  buildGuildSettingsMemberRowState,
  buildGuildSettingsOverviewImageState,
  buildGuildSettingsRankOptionsByCurrentRankId,
  buildGuildSettingsRankRowState,
  createGuildSettingsOverrideEditState,
} from '../../../client/src/features/guild/guildSettingsPanelsModel.mjs';

test('guild settings panels model prefers the preview image before the stored guild image URL', () => {
  assert.deepEqual(
    buildGuildSettingsOverviewImageState({
      guildImage: 'guild/banner.png',
      imagePreview: 'blob:preview',
      getFileUrlFn: (fileUrl) => `https://cdn.example/${fileUrl}`,
    }),
    { imgSrc: 'blob:preview' }
  );

  assert.deepEqual(
    buildGuildSettingsOverviewImageState({
      guildImage: 'guild/banner.png',
      getFileUrlFn: (fileUrl) => `https://cdn.example/${fileUrl}`,
    }),
    { imgSrc: 'https://cdn.example/guild/banner.png' }
  );
});

test('guild settings panels model derives rank options by current rank order', () => {
  const ranks = [
    { id: 'master', rank_order: 0 },
    { id: 'officer', rank_order: 1 },
    { id: 'member', rank_order: 2 },
    { id: 'initiate', rank_order: 3 },
  ];
  const next = buildGuildSettingsRankOptionsByCurrentRankId({
    ranks,
    myRankOrder: 1,
  });

  assert.deepEqual(next.get('master').map((rank) => rank.id), ['master', 'member', 'initiate']);
  assert.deepEqual(next.get('member').map((rank) => rank.id), ['member', 'initiate']);
});

test('guild settings panels model derives member row state and override edit defaults', () => {
  const member = {
    id: 'user-2',
    username: 'Scout',
    rankId: 'member',
    rankOrder: 2,
    permissionOverrides: {
      guild_chat_speak: true,
      invite_member: true,
    },
    permissions: {
      guild_chat_listen: true,
      remove_member: true,
    },
  };

  const rowState = buildGuildSettingsMemberRowState({
    member,
    rankOptionsByCurrentRankId: new Map([
      ['member', [{ id: 'member' }, { id: 'initiate' }]],
    ]),
    myRankOrder: 1,
    showControls: true,
    isGuildMaster: true,
    userId: 'user-1',
    expandedMemberId: 'user-2',
  });

  assert.equal(rowState.canModify, true);
  assert.equal(rowState.canEditOverrides, true);
  assert.equal(rowState.hasOverrides, true);
  assert.equal(rowState.isExpanded, true);
  assert.equal(rowState.avatarLetter, 'S');
  assert.deepEqual(rowState.rankOptions.map((rank) => rank.id), ['member', 'initiate']);
  assert.deepEqual(rowState.rankPermissions, { remove_member: true });
  assert.deepEqual(createGuildSettingsOverrideEditState(member), { invite_member: true });
});

test('guild settings panels model applies override toggles by removing values that match the rank default', () => {
  assert.deepEqual(
    applyGuildSettingsOverrideToggle({
      previousEdits: { invite_member: true, remove_member: false },
      permission: 'invite_member',
      nextValue: false,
      rankDefault: false,
    }),
    { remove_member: false }
  );

  assert.deepEqual(
    applyGuildSettingsOverrideToggle({
      previousEdits: { remove_member: false },
      permission: 'invite_member',
      nextValue: true,
      rankDefault: false,
    }),
    { remove_member: false, invite_member: true }
  );
});

test('guild settings panels model derives rank row edit state, member count copy, and admin transfer targets', () => {
  assert.deepEqual(
    buildGuildSettingsRankRowState({
      rank: { id: 'member', rank_order: 2 },
      editingRank: 'member',
      myRankOrder: 1,
      canSetPerms: true,
    }),
    { isEditing: true, canEdit: true }
  );

  assert.equal(buildGuildSettingsMemberCountLabel(1), '1 member');
  assert.equal(buildGuildSettingsMemberCountLabel(3), '3 members');

  assert.deepEqual(
    buildGuildSettingsAdminState({
      members: [
        { id: 'user-1', username: 'Leader' },
        { id: 'user-2', username: 'Scout' },
      ],
      userId: 'user-1',
    }),
    {
      otherMembers: [{ id: 'user-2', username: 'Scout' }],
    }
  );
});
