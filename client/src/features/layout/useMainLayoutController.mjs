import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useSocket } from '../../contexts/SocketContext';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { useMainLayoutControllerComposition } from './useMainLayoutControllerComposition.mjs';
import { useMainLayoutControllerDerivedState } from './useMainLayoutControllerDerivedState.mjs';
import { useMainLayoutControllerState } from './useMainLayoutControllerState.mjs';

export function useMainLayoutController() {
  const { socket } = useSocket();
  const { currentGuild, currentGuildData } = useGuild();
  const { user } = useAuth();
  const { screenSharing, voiceChannels, channelId } = useVoiceContext();
  const { peers } = useVoicePresenceContext();

  const state = useMainLayoutControllerState();

  const { onlineIds } = useOnlineUsers();

  const derived = useMainLayoutControllerDerivedState({
    screenSharing,
    peers,
    channelId,
    voiceChannels,
    conversation: state.conversation,
    currentGuild,
    currentGuildData,
    conversationName: state.conversationName,
    currentUserId: user?.userId || null,
    onlineIds,
    guildChatCompact: state.guildChatCompact,
    guildChatExpanded: state.guildChatExpanded,
    streamImmersive: state.streamImmersive,
    updateAvailable: state.updateAvailable,
    appVersion: state.appVersion,
  });

  return useMainLayoutControllerComposition({
    socket,
    currentGuild,
    currentGuildData,
    user,
    screenSharing,
    voiceChannels,
    channelId,
    state,
    derived,
  });
}
