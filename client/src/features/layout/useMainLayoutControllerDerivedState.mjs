import { useMemo } from 'react';

import { isE2EInitialized } from '../../crypto/sessionManager.js';
import {
  buildMainLayoutDerivedShellState,
  buildMainLayoutDerivedVoiceState,
} from './mainLayoutControllerBindings.mjs';
import {
  buildMainLayoutDerivedShellInput,
  buildMainLayoutDerivedVoiceInput,
} from './mainLayoutControllerInputs.mjs';

export function useMainLayoutControllerDerivedState({
  screenSharing = {},
  peers = {},
  channelId = null,
  voiceChannels = [],
  conversation = null,
  currentGuild = null,
  currentGuildData = null,
  conversationName = '',
  onlineIds = new Set(),
  currentUserId = null,
  guildChatCompact = false,
  guildChatExpanded = false,
  streamImmersive = false,
  updateAvailable = false,
  appVersion = '',
} = {}) {
  const isOnline = conversation?.type === 'dm' && onlineIds.has(conversation.id);
  const e2eReady = isE2EInitialized();

  const {
    activeVoiceChannel,
    activeRemoteStreamer,
    streamConversationMatchesActiveVoice,
  } = useMemo(() => buildMainLayoutDerivedVoiceState(buildMainLayoutDerivedVoiceInput({
    screenSharing,
    peers,
    channelId,
    voiceChannels,
    conversation,
    currentUserId,
  })), [screenSharing, peers, channelId, voiceChannels, conversation, currentUserId]);

  const {
    guildChatAvailable,
    showGuildChatDock,
    guildChatDockState,
    headerState,
    updateButtonState,
  } = useMemo(() => buildMainLayoutDerivedShellState(buildMainLayoutDerivedShellInput({
    currentGuild,
    currentGuildData,
    conversation,
    conversationName,
    isOnline,
    e2eReady,
    screenSharing,
    currentUserId,
    channelId,
    voiceChannels,
    guildChatCompact,
    guildChatExpanded,
    streamImmersive,
    updateAvailable,
    appVersion,
  })), [
    currentGuild,
    currentGuildData,
    conversation,
    conversationName,
    isOnline,
    e2eReady,
    screenSharing,
    currentUserId,
    channelId,
    voiceChannels,
    guildChatCompact,
    guildChatExpanded,
    streamImmersive,
    updateAvailable,
    appVersion,
  ]);

  return {
    isOnline,
    e2eReady,
    activeVoiceChannel,
    activeRemoteStreamer,
    streamConversationMatchesActiveVoice,
    guildChatAvailable,
    showGuildChatDock,
    guildChatDockState,
    headerState,
    updateButtonState,
  };
}
