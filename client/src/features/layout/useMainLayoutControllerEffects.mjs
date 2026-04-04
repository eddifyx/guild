import {
  buildMainLayoutConversationEffectsOptions,
  buildMainLayoutShellEffectsOptions,
} from './mainLayoutControllerBindings.mjs';
import {
  buildMainLayoutConversationEffectsInput,
  buildMainLayoutShellEffectsInput,
} from './mainLayoutControllerInputs.mjs';
import { useMainLayoutConversationEffects } from './useMainLayoutConversationEffects.mjs';
import { useMainLayoutShellEffects } from './useMainLayoutShellEffects.mjs';

export function useMainLayoutControllerEffects({
  screenSharing = {},
  conversation = null,
  conversationName = '',
  user = null,
  channelId = null,
  activeVoiceChannel = null,
  activeRemoteStreamer = null,
  streamConversationMatchesActiveVoice = false,
  voiceChannels = [],
  socket = null,
  setConversationFn = () => {},
  setConversationNameFn = () => {},
  clearConversationPerfTraceFn = () => {},
  prevConversationRef = null,
  prevConversationNameRef = null,
  prevConversationTypeRef = null,
  prevJoinedVoiceChannelIdRef = null,
  setShowPiPFn = () => {},
  e2eWarning = false,
  setE2eWarningFn = () => {},
  refreshLatestVersionInfoFn = () => {},
  setAppVersionFn = () => {},
  myRooms = [],
  rooms = [],
  clearGuildChatUnreadMentionsFn = () => {},
  handleSelectDM = () => {},
  handleSelectRoom = () => {},
  setConversationStateFn = () => {},
  guildChatInitialFocusAppliedRef = null,
  currentGuildData = null,
  showGuildChatDock = false,
  focusGuildChatComposerFn = () => {},
  streamImmersive = false,
  setStreamImmersiveFn = () => {},
  guildChatAvailable = false,
  guildChatExpanded = false,
  setGuildChatExpandedFn = () => {},
  setGuildChatCompactFn = () => {},
} = {}) {
  useMainLayoutConversationEffects(buildMainLayoutConversationEffectsOptions(
    buildMainLayoutConversationEffectsInput({
      screenSharing,
      conversation,
      conversationName,
      user,
      channelId,
      activeVoiceChannel,
      activeRemoteStreamer,
      streamConversationMatchesActiveVoice,
      voiceChannels,
      socket,
      setConversationFn,
      setConversationNameFn,
      clearConversationFn: () => {
        setConversationFn(null);
        setConversationNameFn('');
      },
      clearConversationPerfTraceFn,
      prevConversationRef,
      prevConversationNameRef,
      prevConversationTypeRef,
      prevJoinedVoiceChannelIdRef,
      setShowPiPFn,
    })
  ));

  useMainLayoutShellEffects(buildMainLayoutShellEffectsOptions(
    buildMainLayoutShellEffectsInput({
      e2eWarning,
      setE2eWarningFn,
      refreshLatestVersionInfoFn,
      setAppVersionFn,
      socket,
      myRooms,
      rooms,
      conversation,
      clearConversationPerfTraceFn,
      clearGuildChatUnreadMentionsFn,
      handleSelectDM,
      handleSelectRoom,
      setConversationStateFn,
      guildChatInitialFocusAppliedRef,
      currentGuildData,
      showGuildChatDock,
      focusGuildChatComposerFn,
      streamImmersive,
      setStreamImmersiveFn,
      guildChatAvailable,
      guildChatExpanded,
      setGuildChatExpandedFn,
      setGuildChatCompactFn,
    })
  ));
}
