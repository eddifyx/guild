import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMainLayoutViewState } from '../../../client/src/features/layout/mainLayoutViewState.mjs';

test('main layout view state wires alerts, pip navigation, and title bar closures through one pure builder', async () => {
  const calls = [];

  const viewState = buildMainLayoutViewState({
    insecureConnection: true,
    e2eWarning: true,
    versionToast: { message: 'Update ready' },
    showUpdateOverlay: true,
    latestVersionInfo: { version: '1.2.3' },
    serverUrl: 'https://prod.guild.test',
    setVersionToastFn: (value) => calls.push(['set-toast', value]),
    setShowUpdateOverlayFn: (value) => calls.push(['set-overlay', value]),
    headerState: { title: 'Guild' },
    updateButtonState: { label: 'Update' },
    setShowVerifyIdentityFn: (value) => calls.push(['set-verify', value]),
    handleUpdateButtonClickFn: async () => calls.push(['update-click']),
    windowObj: { id: 'window' },
    showPiP: true,
    conversationType: 'stream',
    handleSelectStreamFn: (userId, username) => calls.push(['select-stream', userId, username]),
    setShowPiPFn: (value) => calls.push(['set-pip', value]),
  });

  viewState.alerts.onDismissVersionToast();
  viewState.alerts.onDismissUpdateOverlay();
  viewState.titleBar.onRequestVerifyIdentity();
  viewState.titleBar.onUpdateButtonClick();
  viewState.pip.onNavigate('user-2', 'Beta');
  viewState.pip.onClose();

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(viewState.alerts.insecureConnection, true);
  assert.equal(viewState.alerts.e2eWarning, true);
  assert.equal(viewState.pip.showPiP, true);
  assert.deepEqual(calls, [
    ['set-toast', null],
    ['set-overlay', false],
    ['set-verify', true],
    ['update-click'],
    ['select-stream', 'user-2', 'Beta'],
    ['set-pip', false],
    ['set-pip', false],
  ]);
});

test('main layout view state exposes verify identity closures only for DM conversations', () => {
  const calls = [];

  const viewState = buildMainLayoutViewState({
    showVerifyIdentity: true,
    conversationType: 'dm',
    conversationId: 'dm-1',
    conversationName: 'Alpha',
    setShowVerifyIdentityFn: (value) => calls.push(['set-verify', value]),
  });

  assert.equal(viewState.verifyIdentityState.userId, 'dm-1');
  assert.equal(viewState.verifyIdentityState.username, 'Alpha');

  viewState.verifyIdentityState.onClose();
  viewState.verifyIdentityState.onVerified();

  assert.deepEqual(calls, [
    ['set-verify', false],
    ['set-verify', false],
  ]);
});

test('main layout view state builds content shell with guild chat and stream toggle wiring', () => {
  const calls = [];

  const viewState = buildMainLayoutViewState({
    rooms: [{ id: 'room-1', name: 'General' }],
    myRooms: ['room-1'],
    createRoomFn: () => calls.push(['create-room']),
    joinRoomFn: () => calls.push(['join-room']),
    renameRoomFn: () => calls.push(['rename-room']),
    deleteRoomFn: () => calls.push(['delete-room']),
    conversation: { type: 'room', id: 'room-1' },
    handleSelectRoomFn: (id) => calls.push(['select-room', id]),
    handleSelectDMFn: (id) => calls.push(['select-dm', id]),
    handleSelectAssetDumpFn: () => calls.push(['asset-dump']),
    handleSelectAddonsFn: () => calls.push(['addons']),
    handleSelectStreamFn: () => calls.push(['stream']),
    handleSelectNostrProfileFn: (id) => calls.push(['nostr-profile', id]),
    handleSelectVoiceChannelFn: (id) => calls.push(['voice', id]),
    handleSelectGuildChatHomeFn: () => calls.push(['guild-home']),
    handleSelectGuildChatFullFn: () => calls.push(['guild-full']),
    handleCollapseGuildChatFullFn: () => calls.push(['guild-collapse']),
    guildChatHasUnreadMention: true,
    unreadCounts: { dm1: 2 },
    unreadRoomCounts: { room1: 1 },
    conversationOpenTraceId: 'trace-1',
    setGuildChatCompactFn: (value) => calls.push(['set-compact', value]),
    streamImmersive: false,
    setStreamImmersiveFn: (updater) => calls.push(['toggle-immersive', updater(true)]),
    guildChatDockState: { visible: true },
    currentGuild: { id: 'guild-1' },
    guildChat: { id: 'dock' },
    guildChatAvailable: true,
    guildChatCompact: false,
    guildChatExpanded: false,
  });

  viewState.contentShell.onToggleStreamImmersive();
  viewState.contentShell.onSelectTavern();

  assert.equal(viewState.contentShell.guildChatMentionUnread, true);
  assert.equal(viewState.contentShell.conversationOpenTraceId, 'trace-1');
  assert.deepEqual(calls, [
    ['toggle-immersive', false],
    ['guild-home'],
  ]);
});
