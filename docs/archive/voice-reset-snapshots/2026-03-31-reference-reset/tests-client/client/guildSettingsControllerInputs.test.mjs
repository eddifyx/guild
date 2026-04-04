import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildSettingsControllerActionInput,
  buildGuildSettingsControllerViewInput,
  buildGuildSettingsRuntimeEffectsInput,
  buildUseGuildSettingsControllerActionsInput,
  buildUseGuildSettingsControllerEffectsInput,
  buildUseGuildSettingsControllerViewStateInput,
} from '../../../client/src/features/guild/guildSettingsControllerInputs.mjs';

test('guild settings controller inputs preserve canonical runtime-effects, action, and view contracts', () => {
  const refs = { loadingRef: { current: {} } };
  const state = { setMembersFn: () => {} };
  const load = { loadMembers: () => {} };
  const runtimeEffectsInput = buildGuildSettingsRuntimeEffectsInput({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    tab: 'Overview',
    membersLoaded: true,
    ranksLoaded: false,
    inviteLoaded: true,
    motdLoaded: false,
    openTraceId: 'trace-1',
    onClose: () => {},
    refs,
    state,
    load,
    endPerfTraceAfterNextPaintFn: () => {},
  });

  assert.equal(runtimeEffectsInput.currentGuild, 'guild-1');
  assert.equal(runtimeEffectsInput.openTraceId, 'trace-1');
  assert.equal(runtimeEffectsInput.refs, refs);
  assert.equal(runtimeEffectsInput.state, state);
  assert.equal(runtimeEffectsInput.load, load);

  const controllerEffectsInput = buildUseGuildSettingsControllerEffectsInput({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    tab: 'Overview',
    membersLoaded: true,
    ranksLoaded: false,
    inviteLoaded: true,
    motdLoaded: false,
    openTraceId: 'trace-2',
    onClose: () => {},
    loadingRef: refs.loadingRef,
    completedOpenTraceIdsRef: { current: new Set() },
    setRanksFn: () => {},
    setRanksLoadedFn: () => {},
    setInviteCodeFn: () => {},
    setInviteLoadedFn: () => {},
    setMotdFn: () => {},
    setMotdLoadedFn: () => {},
    setMembersFn: () => {},
    setMembersLoadedFn: () => {},
    setGuildNameFn: () => {},
    setGuildDescFn: () => {},
    setGuildPublicFn: () => {},
    setGuildImageFn: () => {},
    setImagePreviewFn: () => {},
    loadMembers: () => {},
    loadRanks: () => {},
    loadInviteCode: () => {},
    loadMotd: () => {},
    endPerfTraceAfterNextPaintFn: () => {},
  });

  assert.equal(controllerEffectsInput.openTraceId, 'trace-2');
  assert.equal(controllerEffectsInput.refs.loadingRef, refs.loadingRef);
  assert.equal(typeof controllerEffectsInput.state.setGuildNameFn, 'function');
  assert.equal(typeof controllerEffectsInput.load.loadMotd, 'function');

  const flash = () => {};
  const actionInput = buildGuildSettingsControllerActionInput({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
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
    onClose: () => {},
    deps: { updateGuildFn: () => {} },
    state: { setGuildImageFn: () => {} },
  });

  assert.equal(actionInput.currentGuildName, 'Guild One');
  assert.equal(actionInput.flash, flash);
  assert.equal(actionInput.members[0].id, 'user-1');

  const controllerActionInput = buildUseGuildSettingsControllerActionsInput({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    guildName: 'Guild One',
    flash,
    updateGuildFn: () => {},
    setInviteLoadedFn: () => {},
  });

  assert.equal(controllerActionInput.currentGuildData.name, 'Guild One');
  assert.equal(controllerActionInput.flash, flash);
  assert.equal(typeof controllerActionInput.setInviteLoadedFn, 'function');

  const handlers = { onSaveOverview: () => {} };
  const setters = { setGuildName: () => {} };
  const viewInput = buildGuildSettingsControllerViewInput({
    shellState: { canInvite: true },
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
    loadMembers: () => {},
    flash,
    handlers,
    setters,
  });

  assert.equal(viewInput.shellState.canInvite, true);
  assert.equal(viewInput.currentGuildData.name, 'Guild One');
  assert.equal(viewInput.handlers, handlers);
  assert.equal(viewInput.setters, setters);

  const controllerViewInput = buildUseGuildSettingsControllerViewStateInput({
    shellState: { canInvite: true },
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    tab: 'Members',
    updateMemberPermissionsFn: () => {},
    loadMembersFn: () => {},
    handlers,
    setters,
  });

  assert.equal(controllerViewInput.currentGuildData.name, 'Guild One');
  assert.equal(typeof controllerViewInput.updateMemberPermissionsFn, 'function');
  assert.equal(typeof controllerViewInput.loadMembersFn, 'function');
  assert.equal(controllerViewInput.handlers, handlers);
});
