import { useMainLayoutControllerRuntimeView } from './useMainLayoutControllerRuntimeView.mjs';
import { useMainLayoutControllerSupport } from './useMainLayoutControllerSupport.mjs';

export function useMainLayoutControllerComposition({
  socket = null,
  currentGuild = null,
  currentGuildData = null,
  user = null,
  screenSharing = {},
  voiceChannels = [],
  channelId = null,
  state = {},
  derived = {},
} = {}) {
  const {
    guildChatAvailable = false,
  } = derived;

  const support = useMainLayoutControllerSupport({
    currentGuild,
    conversation: state.conversation,
    guildChatAvailable,
  });

  return useMainLayoutControllerRuntimeView({
    socket,
    currentGuild,
    currentGuildData,
    user,
    screenSharing,
    voiceChannels,
    channelId,
    state,
    derived,
    support,
  });
}
