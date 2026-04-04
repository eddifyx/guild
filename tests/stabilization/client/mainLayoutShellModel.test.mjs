import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMainLayoutConversationHeaderState,
  buildMainLayoutGuildChatDockState,
  buildMainLayoutUpdateButtonState,
  collectMainLayoutVoiceParticipants,
  findMainLayoutActivePeerStreamerId,
  findMainLayoutActiveRemoteStreamer,
  findMainLayoutActiveVoiceChannel,
  getMainLayoutGuildChatAvailability,
  getMainLayoutStreamConversationMatchesActiveVoice,
} from '../../../client/src/features/layout/mainLayoutShellModel.mjs';

test('main layout shell model derives conversation header states consistently', () => {
  assert.deepEqual(buildMainLayoutConversationHeaderState({
    conversation: null,
    currentGuild: 'guild-1',
    currentGuildName: 'The Guild',
  }), {
    kind: 'home',
    title: 'Tavern',
    subtitle: 'The Guild',
  });

  assert.deepEqual(buildMainLayoutConversationHeaderState({
    conversation: { type: 'dm', id: 'user-2' },
    conversationName: 'Nova',
    isOnline: true,
    e2eReady: true,
  }), {
    kind: 'dm',
    title: 'Nova',
    subtitle: 'Online',
    isOnline: true,
    canVerifyIdentity: true,
  });

  assert.deepEqual(buildMainLayoutConversationHeaderState({
    conversation: { type: 'stream', id: 'user-2' },
    conversationName: 'Nova Stream',
    currentUserId: 'user-1',
    channelId: 'voice-1',
    voiceChannels: [
      {
        id: 'voice-1',
        participants: [{ userId: 'user-2', screenSharing: true }],
      },
    ],
  }), {
    kind: 'stream',
    title: 'Nova Stream',
    live: true,
  });
});

test('main layout shell model derives update button and dock shell state consistently', () => {
  assert.deepEqual(buildMainLayoutUpdateButtonState({
    updateAvailable: true,
    appVersion: '1.0.70',
  }), {
    highlighted: true,
    title: 'Update available — click for details',
  });

  assert.deepEqual(buildMainLayoutGuildChatDockState({
    guildChatCompact: true,
    showGuildChatDock: true,
    conversationType: 'stream',
    guildChatExpanded: false,
    guildChatAvailable: true,
  }), {
    guildChatDockTargetHeight: 'clamp(148px, 18vh, 210px)',
    shouldReserveGuildChatSpaceForStream: true,
    dockTop: 'calc(100% - clamp(148px, 18vh, 210px))',
    dockHeight: 'clamp(148px, 18vh, 210px)',
    dockZIndex: 2,
    dockOpacity: 1,
    dockPointerEvents: 'auto',
  });
});

test('main layout shell model resolves guild chat availability and active voice stream state', () => {
  assert.equal(getMainLayoutGuildChatAvailability({
    currentGuild: 'guild-1',
    conversationType: 'nostr-profile',
  }), false);
  assert.equal(getMainLayoutGuildChatAvailability({
    currentGuild: 'guild-1',
    conversationType: 'stream',
    streamImmersive: true,
  }), false);
  assert.equal(getMainLayoutGuildChatAvailability({
    currentGuild: 'guild-1',
    conversationType: 'assets',
    streamImmersive: false,
  }), true);

  const voiceChannels = [
    {
      id: 'voice-1',
      participants: [
        { userId: 'user-2', screenSharing: true, username: 'Nova' },
        { userId: 'user-3', screenSharing: false, username: 'Kai' },
      ],
    },
  ];

  const activeVoiceChannel = findMainLayoutActiveVoiceChannel({
    channelId: 'voice-1',
    voiceChannels,
  });
  const allParticipants = collectMainLayoutVoiceParticipants(voiceChannels);
  const activePeerStreamerId = findMainLayoutActivePeerStreamerId({
    screenSharing: false,
    peers: { 'user-2': { screenSharing: true } },
  });
  const activeRemoteStreamer = findMainLayoutActiveRemoteStreamer({
    screenSharing: false,
    activePeerStreamerId,
    activeVoiceChannel,
    allVoiceParticipants: allParticipants,
    currentUserId: 'user-1',
  });

  assert.equal(activeRemoteStreamer.userId, 'user-2');
  assert.equal(getMainLayoutStreamConversationMatchesActiveVoice({
    conversation: { type: 'stream', id: 'user-2' },
    channelId: 'voice-1',
    activeVoiceChannel,
  }), true);
});
