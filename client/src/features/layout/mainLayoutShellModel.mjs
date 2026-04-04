export function buildMainLayoutConversationHeaderState({
  conversation = null,
  currentGuild = null,
  currentGuildName = '',
  conversationName = '',
  isOnline = false,
  e2eReady = false,
  screenSharing = false,
  currentUserId = null,
  channelId = null,
  voiceChannels = [],
} = {}) {
  if (!conversation && currentGuild) {
    return {
      kind: 'home',
      title: 'Tavern',
      subtitle: currentGuildName || 'Guild Home',
    };
  }

  if (!conversation?.type) {
    return null;
  }

  if (conversation.type === 'room') {
    return {
      kind: 'room',
      title: conversationName,
    };
  }

  if (conversation.type === 'dm') {
    return {
      kind: 'dm',
      title: conversationName,
      subtitle: isOnline ? 'Online' : 'Offline',
      isOnline,
      canVerifyIdentity: e2eReady,
    };
  }

  if (conversation.type === 'assets') {
    return {
      kind: 'assets',
      title: 'Asset Dumping Grounds',
      subtitle: 'Files expire after 5 days',
    };
  }

  if (conversation.type === 'addons') {
    return {
      kind: 'addons',
      title: 'Addons',
      subtitle: 'Files stored permanently',
    };
  }

  if (conversation.type === 'nostr-profile') {
    return {
      kind: 'nostr-profile',
      title: conversationName,
      subtitle: 'Nostr Profile',
    };
  }

  if (conversation.type === 'stream') {
    const isLive = conversation.id === currentUserId
      ? screenSharing
      : Boolean(channelId && voiceChannels.some((channel) =>
          channel.id === channelId && channel.participants?.some((participant) => participant.screenSharing)
        ));

    return {
      kind: 'stream',
      title: conversationName || 'Stream',
      live: isLive,
    };
  }

  if (conversation.type === 'voice') {
    return {
      kind: 'voice',
      title: conversationName,
    };
  }

  return null;
}

export function buildMainLayoutUpdateButtonState({
  updateAvailable = false,
  appVersion = '',
} = {}) {
  return {
    highlighted: updateAvailable,
    title: updateAvailable
      ? 'Update available — click for details'
      : `v${appVersion} — Check for updates`,
  };
}

export function getMainLayoutGuildChatAvailability({
  currentGuild = null,
  conversationType = null,
  streamImmersive = false,
} = {}) {
  return !!currentGuild
    && conversationType !== 'room'
    && conversationType !== 'dm'
    && conversationType !== 'nostr-profile'
    && !(conversationType === 'stream' && streamImmersive);
}

export function findMainLayoutActiveVoiceChannel({
  channelId = null,
  voiceChannels = [],
} = {}) {
  if (!channelId) {
    return null;
  }
  return voiceChannels.find((channel) => channel.id === channelId) || null;
}

export function collectMainLayoutVoiceParticipants(voiceChannels = []) {
  return voiceChannels.flatMap((channel) => channel.participants || []);
}

export function findMainLayoutActivePeerStreamerId({
  screenSharing = false,
  peers = {},
} = {}) {
  if (screenSharing) {
    return null;
  }
  return Object.entries(peers || {}).find(([, state]) => state?.screenSharing)?.[0] || null;
}

export function findMainLayoutActiveRemoteStreamer({
  screenSharing = false,
  activePeerStreamerId = null,
  activeVoiceChannel = null,
  allVoiceParticipants = [],
  currentUserId = null,
} = {}) {
  if (screenSharing) {
    return null;
  }

  if (activePeerStreamerId) {
    return (
      (activeVoiceChannel?.participants || []).find((participant) => participant.userId === activePeerStreamerId)
      || allVoiceParticipants.find((participant) => participant.userId === activePeerStreamerId)
      || { userId: activePeerStreamerId, username: 'Stream' }
    );
  }

  return (activeVoiceChannel?.participants || []).find(
    (participant) => participant.screenSharing && participant.userId !== currentUserId
  ) || null;
}

export function getMainLayoutStreamConversationMatchesActiveVoice({
  conversation = null,
  channelId = null,
  activeVoiceChannel = null,
} = {}) {
  return conversation?.type === 'stream'
    && !!channelId
    && !!activeVoiceChannel
    && (activeVoiceChannel.participants || []).some((participant) => participant.userId === conversation.id);
}

export function buildMainLayoutGuildChatDockState({
  guildChatCompact = false,
  showGuildChatDock = false,
  conversationType = null,
  guildChatExpanded = false,
  guildChatAvailable = false,
} = {}) {
  const guildChatDockTargetHeight = guildChatCompact
    ? 'clamp(148px, 18vh, 210px)'
    : 'clamp(384px, 44vh, 560px)';

  return {
    guildChatDockTargetHeight,
    shouldReserveGuildChatSpaceForStream: showGuildChatDock && conversationType === 'stream',
    dockTop: guildChatExpanded ? 0 : `calc(100% - ${guildChatDockTargetHeight})`,
    dockHeight: guildChatExpanded ? '100%' : guildChatDockTargetHeight,
    dockZIndex: guildChatExpanded ? 3 : 2,
    dockOpacity: guildChatAvailable ? 1 : 0,
    dockPointerEvents: guildChatAvailable ? 'auto' : 'none',
  };
}
