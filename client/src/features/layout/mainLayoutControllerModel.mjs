export function buildMainLayoutAlertsState({
  insecureConnection = false,
  e2eWarning = false,
  versionToast = null,
  showUpdateOverlay = false,
  latestVersionInfo = null,
  serverUrl = '',
  onDismissVersionToast,
  onDismissUpdateOverlay,
} = {}) {
  return {
    insecureConnection,
    e2eWarning,
    versionToast,
    onDismissVersionToast,
    showUpdateOverlay,
    latestVersionInfo,
    serverUrl,
    onDismissUpdateOverlay,
  };
}

export function buildMainLayoutTitleBarState({
  headerState,
  updateButtonState,
  onRequestVerifyIdentity,
  onUpdateButtonClick,
  windowObj = null,
} = {}) {
  return {
    headerState,
    updateButtonState,
    onRequestVerifyIdentity,
    onUpdateButtonClick,
    onWindowMinimize: () => windowObj?.electronAPI?.windowMinimize?.(),
    onWindowMaximize: () => windowObj?.electronAPI?.windowMaximize?.(),
    onWindowClose: () => windowObj?.electronAPI?.windowClose?.(),
  };
}

export function buildMainLayoutPipState({
  showPiP = false,
  conversationType = null,
  onNavigate,
  onClose,
} = {}) {
  return {
    showPiP,
    conversationType,
    onNavigate,
    onClose,
  };
}

export function buildMainLayoutContentShellState({
  rooms,
  myRooms,
  createRoom,
  joinRoom,
  renameRoom,
  deleteRoom,
  conversation,
  onSelectRoom,
  onSelectDM,
  onSelectAssetDump,
  onSelectAddons,
  onSelectStream,
  onSelectNostrProfile,
  onSelectVoiceChannel,
  onSelectTavern,
  guildChatMentionUnread,
  unreadCounts,
  unreadRoomCounts,
  conversationOpenTraceId,
  setGuildChatCompact,
  streamImmersive,
  onToggleStreamImmersive,
  guildChatDockState,
  currentGuild,
  guildChat,
  guildChatAvailable,
  guildChatCompact,
  guildChatExpanded,
  handleCollapseGuildChatFull,
  handleSelectGuildChatFull,
} = {}) {
  return {
    rooms,
    myRooms,
    createRoom,
    joinRoom,
    renameRoom,
    deleteRoom,
    conversation,
    onSelectRoom,
    onSelectDM,
    onSelectAssetDump,
    onSelectAddons,
    onSelectStream,
    onSelectNostrProfile,
    onSelectVoiceChannel,
    onSelectTavern,
    guildChatMentionUnread,
    unreadCounts,
    unreadRoomCounts,
    conversationOpenTraceId,
    setGuildChatCompact,
    streamImmersive,
    onToggleStreamImmersive,
    guildChatDockState,
    currentGuild,
    guildChat,
    guildChatAvailable,
    guildChatCompact,
    guildChatExpanded,
    handleCollapseGuildChatFull,
    handleSelectGuildChatFull,
  };
}

export function buildMainLayoutVerifyIdentityState({
  showVerifyIdentity = false,
  conversationType = null,
  conversationId = null,
  conversationName = '',
  onClose,
  onVerified,
} = {}) {
  if (!showVerifyIdentity || conversationType !== 'dm') {
    return null;
  }

  return {
    userId: conversationId,
    username: conversationName,
    onClose,
    onVerified,
  };
}
