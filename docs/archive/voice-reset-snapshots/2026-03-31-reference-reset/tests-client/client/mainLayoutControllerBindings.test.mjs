import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMainLayoutControllerRuntimeOptions,
  buildMainLayoutConversationEffectsOptions,
  buildMainLayoutDerivedShellState,
  buildMainLayoutDerivedVoiceState,
  buildMainLayoutShellEffectsOptions,
  buildMainLayoutViewStateOptions,
} from '../../../client/src/features/layout/mainLayoutControllerBindings.mjs';

test('main layout controller bindings derive voice shell state through the shared lane models', () => {
  const voiceState = buildMainLayoutDerivedVoiceState({
    screenSharing: false,
    peers: {
      'user-2': { username: 'Beta', screenSharing: true },
    },
    channelId: 'voice-1',
    voiceChannels: [
      {
        id: 'voice-1',
        participants: [
          { userId: 'user-1', username: 'Alpha' },
          { userId: 'user-2', username: 'Beta', screenSharing: true },
        ],
      },
    ],
    conversation: { type: 'stream', id: 'user-2' },
    currentUserId: 'user-1',
  });

  assert.equal(voiceState.activeVoiceChannel.id, 'voice-1');
  assert.equal(voiceState.activeRemoteStreamer.userId, 'user-2');
  assert.equal(voiceState.streamConversationMatchesActiveVoice, true);
});

test('main layout controller bindings derive dock and update shell state consistently', () => {
  const shellState = buildMainLayoutDerivedShellState({
    currentGuild: { id: 'guild-1' },
    currentGuildName: 'Guild',
    conversation: null,
    conversationName: '',
    isOnline: false,
    e2eReady: false,
    screenSharing: {},
    currentUserId: 'user-1',
    channelId: 'voice-1',
    voiceChannels: [],
    guildChatCompact: true,
    guildChatExpanded: false,
    streamImmersive: false,
    updateAvailable: true,
    appVersion: '1.2.3',
  });

  assert.equal(shellState.guildChatAvailable, true);
  assert.equal(shellState.showGuildChatDock, true);
  assert.equal(shellState.guildChatDockState.dockOpacity, 1);
  assert.equal(shellState.headerState.title, 'Tavern');
  assert.equal(shellState.updateButtonState.highlighted, true);
});

test('main layout controller bindings derive dm header state with verify-identity capability', () => {
  const shellState = buildMainLayoutDerivedShellState({
    currentGuild: { id: 'guild-1' },
    currentGuildName: 'Guild',
    conversation: { type: 'dm', id: 'dm-1' },
    conversationName: 'Alpha',
    isOnline: true,
    e2eReady: true,
    screenSharing: {},
    currentUserId: 'user-1',
    channelId: 'voice-1',
    voiceChannels: [],
    guildChatCompact: false,
    guildChatExpanded: false,
    streamImmersive: false,
    updateAvailable: false,
    appVersion: '1.2.3',
  });

  assert.equal(shellState.headerState.title, 'Alpha');
  assert.equal(shellState.headerState.canVerifyIdentity, true);
  assert.equal(shellState.guildChatAvailable, false);
});

test('main layout controller bindings preserve the controller runtime and effect contracts', () => {
  const conversationOpenTraceRef = { current: 'trace-1' };
  const prevConversationRef = { current: null };
  const runtimeOptions = buildMainLayoutControllerRuntimeOptions({
    socket: { id: 'socket' },
    user: { userId: 'user-1' },
    clearUnreadFn: () => {},
    clearUnreadRoomFn: () => {},
    clearGuildChatUnreadMentionsFn: () => {},
    conversationOpenTraceRef,
    setConversationFn: () => {},
    setConversationNameFn: () => {},
    setConversationOpenTraceIdFn: () => {},
    setLatestVersionInfoFn: () => {},
    setUpdateAvailableFn: () => {},
    setShowUpdateOverlayFn: () => {},
    setVersionToastFn: () => {},
    setGuildChatExpandedFn: () => {},
    updateState: { getConversation: () => null },
  });
  const conversationEffectsOptions = buildMainLayoutConversationEffectsOptions({
    conversation: { type: 'dm', id: 'dm-1' },
    prevConversationRef,
    setShowPiPFn: () => {},
  });
  const shellEffectsOptions = buildMainLayoutShellEffectsOptions({
    showGuildChatDock: true,
    guildChatAvailable: true,
    guildChatExpanded: false,
    setGuildChatExpandedFn: () => {},
    setGuildChatCompactFn: () => {},
  });

  assert.equal(runtimeOptions.conversationOpenTraceRef, conversationOpenTraceRef);
  assert.equal(runtimeOptions.updateState.getConversation(), null);
  assert.equal(conversationEffectsOptions.prevConversationRef, prevConversationRef);
  assert.equal(conversationEffectsOptions.conversation.type, 'dm');
  assert.equal(shellEffectsOptions.showGuildChatDock, true);
  assert.equal(shellEffectsOptions.guildChatAvailable, true);
});

test('main layout controller bindings shape the view-state contract from canonical shell inputs', () => {
  const options = buildMainLayoutViewStateOptions({
    insecureConnection: true,
    e2eWarning: true,
    versionToast: { message: 'Update ready' },
    showUpdateOverlay: true,
    latestVersionInfo: { version: '1.2.3' },
    serverUrl: 'https://prod.guild.test',
    headerState: { title: 'Guild' },
    updateButtonState: { label: 'Update' },
    handleUpdateButtonClick: async () => {},
    windowObj: { id: 'window' },
    showPiP: true,
    conversation: { type: 'dm', id: 'dm-1' },
    handleSelectStream: () => {},
    setShowPiP: () => {},
    rooms: [{ id: 'room-1' }],
    myRooms: ['room-1'],
    createRoom: () => {},
    joinRoom: () => {},
    renameRoom: () => {},
    deleteRoom: () => {},
    handleSelectRoom: () => {},
    handleSelectDM: () => {},
    handleSelectAssetDump: () => {},
    handleSelectAddons: () => {},
    handleSelectNostrProfile: () => {},
    handleSelectVoiceChannel: () => {},
    handleSelectGuildChatHome: () => {},
    handleSelectGuildChatFull: () => {},
    handleCollapseGuildChatFull: () => {},
    guildChatHasUnreadMention: true,
    unreadCounts: { dm1: 2 },
    unreadRoomCounts: { room1: 1 },
    conversationOpenTraceId: 'trace-1',
    setGuildChatCompact: () => {},
    streamImmersive: false,
    setStreamImmersive: () => {},
    guildChatDockState: { visible: true },
    currentGuild: { id: 'guild-1' },
    guildChat: { id: 'dock' },
    guildChatAvailable: true,
    guildChatCompact: false,
    guildChatExpanded: false,
    showVerifyIdentity: true,
    conversationName: 'Alpha',
    setVersionToast: () => {},
    setShowUpdateOverlay: () => {},
    setShowVerifyIdentity: () => {},
  });

  assert.equal(options.insecureConnection, true);
  assert.equal(options.conversationType, 'dm');
  assert.equal(options.conversationId, 'dm-1');
  assert.equal(options.guildChatHasUnreadMention, true);
  assert.equal(options.guildChatAvailable, true);
});
