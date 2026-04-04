import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildSettingsActionOptions,
  buildGuildSettingsControllerViewState,
} from '../../../client/src/features/guild/guildSettingsControllerBindings.mjs';

test('guild settings controller bindings preserve the shared action option contract', () => {
  const deps = { updateGuildFn: () => {} };
  const state = { setGuildImageFn: () => {} };
  const flash = () => {};
  const onClose = () => {};

  assert.deepEqual(
    buildGuildSettingsActionOptions({
      currentGuild: 'guild-1',
      currentGuildName: 'Guild One',
      guildName: 'Guild One',
      guildDesc: 'desc',
      guildPublic: true,
      guildImage: '/uploads/icon.png',
      motd: 'hello',
      newRankName: 'Scout',
      transferTarget: 'user-2',
      members: [{ id: 'user-1' }],
      confirmDialog: { title: 'Confirm' },
      flash,
      onClose,
      deps,
      state,
    }),
    {
      currentGuild: 'guild-1',
      currentGuildName: 'Guild One',
      guildName: 'Guild One',
      guildDesc: 'desc',
      guildPublic: true,
      guildImage: '/uploads/icon.png',
      motd: 'hello',
      newRankName: 'Scout',
      transferTarget: 'user-2',
      members: [{ id: 'user-1' }],
      confirmDialog: { title: 'Confirm' },
      flash,
      onClose,
      deps,
      state,
    }
  );
});

test('guild settings controller bindings build the canonical view-state contract', () => {
  const calls = [];
  const handlers = {
    onSaveOverview: () => {},
    onSaveMotd: () => {},
    onImageSelect: () => {},
    onRemoveImage: () => {},
    onChangeRank: () => {},
    onKick: () => {},
    onCreateRank: () => {},
    onUpdateRank: () => {},
    onDeleteRank: () => {},
    onRegenerateInvite: () => {},
    onTransfer: () => {},
    onDisband: () => {},
  };
  const setters = {
    setGuildName: () => {},
    setGuildDesc: () => {},
    setGuildPublic: () => {},
    setMotd: () => {},
    setEditingRank: () => {},
    setNewRankName: () => {},
    setTransferTarget: () => {},
  };
  const flash = () => {};

  const viewState = buildGuildSettingsControllerViewState({
    shellState: {
      canManageTheme: true,
      canModifyMotd: true,
      readOnly: false,
      showMemberControls: true,
      canSetPerms: true,
      canInvite: true,
    },
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    tab: 'Members',
    error: '',
    success: 'saved',
    confirmDialog: null,
    isTabPending: false,
    myRankOrder: 1,
    members: [{ id: 'user-1' }],
    ranks: [{ id: 'rank-1' }],
    inviteCode: 'invite-1',
    transferTarget: 'user-2',
    editingRank: 'rank-1',
    newRankName: 'Scout',
    guildName: 'Guild One',
    guildDesc: 'desc',
    guildPublic: true,
    guildImage: '/uploads/icon.png',
    imagePreview: 'blob:preview',
    motd: 'hello',
    uploadingImage: false,
    userId: 'user-1',
    isGuildMaster: true,
    onClose: () => {},
    onSelectTab: () => {},
    onDismissConfirmDialog: () => {},
    onAcceptConfirmDialog: () => {},
    onLeaveGuild: () => {},
    updateMemberPermissions: () => {},
    loadMembers: ({ force }) => {
      calls.push(force);
    },
    flash,
    handlers,
    setters,
  });

  assert.equal(viewState.membersProps.guildId, 'guild-1');
  assert.equal(viewState.membersProps.isGuildMaster, true);
  assert.equal(viewState.overviewProps.canManageTheme, true);
  assert.equal(viewState.ranksProps.canSetPerms, true);
  assert.equal(viewState.inviteProps.canInvite, true);
  assert.equal(viewState.adminProps.userId, 'user-1');

  viewState.membersProps.onRefreshMembers();
  assert.deepEqual(calls, [true]);
});
