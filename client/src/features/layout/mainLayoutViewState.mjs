import {
  buildMainLayoutAlertsState,
  buildMainLayoutContentShellState,
  buildMainLayoutPipState,
  buildMainLayoutTitleBarState,
  buildMainLayoutVerifyIdentityState,
} from './mainLayoutControllerModel.mjs';

export function buildMainLayoutViewState({
  insecureConnection = false,
  e2eWarning = false,
  versionToast = null,
  showUpdateOverlay = false,
  latestVersionInfo = null,
  serverUrl = '',
  setVersionToastFn = () => {},
  setShowUpdateOverlayFn = () => {},
  headerState = null,
  updateButtonState = null,
  setShowVerifyIdentityFn = () => {},
  handleUpdateButtonClickFn = async () => {},
  windowObj = null,
  showPiP = false,
  conversationType = null,
  handleSelectStreamFn = () => {},
  setShowPiPFn = () => {},
  rooms = [],
  myRooms = [],
  createRoomFn = () => {},
  joinRoomFn = () => {},
  renameRoomFn = () => {},
  deleteRoomFn = () => {},
  conversation = null,
  handleSelectRoomFn = () => {},
  handleSelectDMFn = () => {},
  handleSelectAssetDumpFn = () => {},
  handleSelectAddonsFn = () => {},
  handleSelectNostrProfileFn = () => {},
  handleSelectVoiceChannelFn = () => {},
  handleSelectGuildChatHomeFn = () => {},
  handleSelectGuildChatFullFn = () => {},
  handleCollapseGuildChatFullFn = () => {},
  guildChatHasUnreadMention = false,
  unreadCounts = {},
  unreadRoomCounts = {},
  conversationOpenTraceId = null,
  setGuildChatCompactFn = () => {},
  streamImmersive = false,
  setStreamImmersiveFn = () => {},
  guildChatDockState = null,
  currentGuild = null,
  guildChat = null,
  guildChatAvailable = false,
  guildChatCompact = false,
  guildChatExpanded = false,
  showVerifyIdentity = false,
  conversationId = null,
  conversationName = '',
} = {}) {
  const alerts = buildMainLayoutAlertsState({
    insecureConnection,
    e2eWarning,
    versionToast,
    showUpdateOverlay,
    latestVersionInfo,
    serverUrl,
    onDismissVersionToast: () => setVersionToastFn(null),
    onDismissUpdateOverlay: () => setShowUpdateOverlayFn(false),
  });

  const titleBar = buildMainLayoutTitleBarState({
    headerState,
    updateButtonState,
    onRequestVerifyIdentity: () => setShowVerifyIdentityFn(true),
    onUpdateButtonClick: () => {
      void handleUpdateButtonClickFn();
    },
    windowObj,
  });

  const pip = buildMainLayoutPipState({
    showPiP,
    conversationType,
    onNavigate: (userId, username) => {
      handleSelectStreamFn(userId, username);
      setShowPiPFn(false);
    },
    onClose: () => setShowPiPFn(false),
  });

  const contentShell = buildMainLayoutContentShellState({
    rooms,
    myRooms,
    createRoom: createRoomFn,
    joinRoom: joinRoomFn,
    renameRoom: renameRoomFn,
    deleteRoom: deleteRoomFn,
    conversation,
    onSelectRoom: handleSelectRoomFn,
    onSelectDM: handleSelectDMFn,
    onSelectAssetDump: handleSelectAssetDumpFn,
    onSelectAddons: handleSelectAddonsFn,
    onSelectStream: handleSelectStreamFn,
    onSelectNostrProfile: handleSelectNostrProfileFn,
    onSelectVoiceChannel: handleSelectVoiceChannelFn,
    onSelectTavern: handleSelectGuildChatHomeFn,
    guildChatMentionUnread: guildChatHasUnreadMention,
    unreadCounts,
    unreadRoomCounts,
    conversationOpenTraceId,
    setGuildChatCompact: setGuildChatCompactFn,
    streamImmersive,
    onToggleStreamImmersive: () => setStreamImmersiveFn((prev) => !prev),
    guildChatDockState,
    currentGuild,
    guildChat,
    guildChatAvailable,
    guildChatCompact,
    guildChatExpanded,
    handleCollapseGuildChatFull: handleCollapseGuildChatFullFn,
    handleSelectGuildChatFull: handleSelectGuildChatFullFn,
  });

  const verifyIdentityState = buildMainLayoutVerifyIdentityState({
    showVerifyIdentity,
    conversationType,
    conversationId,
    conversationName,
    onClose: () => setShowVerifyIdentityFn(false),
    onVerified: () => setShowVerifyIdentityFn(false),
  });

  return {
    alerts,
    titleBar,
    pip,
    contentShell,
    verifyIdentityState,
  };
}
