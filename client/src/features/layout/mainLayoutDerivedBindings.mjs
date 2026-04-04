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
} from './mainLayoutShellModel.mjs';

export function buildMainLayoutDerivedVoiceState({
  screenSharing = {},
  peers = {},
  channelId = null,
  voiceChannels = [],
  conversation = null,
  currentUserId = null,
} = {}) {
  const activeVoiceChannel = findMainLayoutActiveVoiceChannel({
    channelId,
    voiceChannels,
  });
  const allVoiceParticipants = collectMainLayoutVoiceParticipants(voiceChannels);
  const activePeerStreamerId = findMainLayoutActivePeerStreamerId({
    screenSharing,
    peers,
  });
  const activeRemoteStreamer = findMainLayoutActiveRemoteStreamer({
    screenSharing,
    activePeerStreamerId,
    activeVoiceChannel,
    allVoiceParticipants,
    currentUserId,
  });
  const streamConversationMatchesActiveVoice = getMainLayoutStreamConversationMatchesActiveVoice({
    conversation,
    channelId,
    activeVoiceChannel,
  });

  return {
    activeVoiceChannel,
    allVoiceParticipants,
    activePeerStreamerId,
    activeRemoteStreamer,
    streamConversationMatchesActiveVoice,
  };
}

export function buildMainLayoutDerivedShellState({
  currentGuild = null,
  currentGuildName = '',
  conversation = null,
  conversationName = '',
  isOnline = false,
  e2eReady = false,
  screenSharing = {},
  currentUserId = null,
  channelId = null,
  voiceChannels = [],
  guildChatCompact = false,
  guildChatExpanded = false,
  streamImmersive = false,
  updateAvailable = false,
  appVersion = '',
} = {}) {
  const guildChatAvailable = getMainLayoutGuildChatAvailability({
    currentGuild,
    conversationType: conversation?.type || null,
    streamImmersive,
  });
  const showGuildChatDock = guildChatAvailable && !guildChatExpanded;
  const guildChatDockState = buildMainLayoutGuildChatDockState({
    guildChatCompact,
    showGuildChatDock,
    conversationType: conversation?.type || null,
    guildChatExpanded,
    guildChatAvailable,
  });
  const headerState = buildMainLayoutConversationHeaderState({
    conversation,
    currentGuild,
    currentGuildName,
    conversationName,
    isOnline,
    e2eReady,
    screenSharing,
    currentUserId,
    channelId,
    voiceChannels,
  });
  const updateButtonState = buildMainLayoutUpdateButtonState({
    updateAvailable,
    appVersion,
  });

  return {
    guildChatAvailable,
    showGuildChatDock,
    guildChatDockState,
    headerState,
    updateButtonState,
  };
}
