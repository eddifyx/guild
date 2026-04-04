import { useEffect } from 'react';
import { BOARDS_DISABLED } from '../messaging/boardAvailability.mjs';
import {
  syncActiveStreamConversationState,
  syncJoinedVoiceConversationState,
  syncPiPVisibilityState,
  syncScreenShareConversationState,
} from './layoutConversationRuntime.mjs';
import { bindRoomLifecycle } from './layoutShellRuntime.mjs';

export function useMainLayoutConversationEffects({
  screenSharing,
  conversation,
  conversationName,
  userId = null,
  username = null,
  channelId = null,
  activeVoiceChannel = null,
  activeRemoteStreamer = null,
  streamConversationMatchesActiveVoice = false,
  voiceChannels = [],
  socket = null,
  setConversationFn,
  setConversationNameFn,
  clearConversationFn,
  clearConversationPerfTraceFn,
  prevConversationRef,
  prevConversationNameRef,
  prevConversationTypeRef,
  prevJoinedVoiceChannelIdRef,
  setShowPiPFn,
} = {}) {
  useEffect(() => {
    if (!BOARDS_DISABLED || conversation?.type !== 'room') {
      return;
    }

    clearConversationPerfTraceFn?.('boards-disabled');
    clearConversationFn?.();
  }, [conversation?.type, clearConversationFn, clearConversationPerfTraceFn]);

  useEffect(() => {
    syncScreenShareConversationState({
      screenSharing,
      conversation,
      conversationName,
      userId,
      username,
      prevConversationRef,
      prevConversationNameRef,
      setConversationFn,
      setConversationNameFn,
    });
  }, [
    screenSharing,
    conversation,
    conversationName,
    userId,
    username,
    prevConversationRef,
    prevConversationNameRef,
    setConversationFn,
    setConversationNameFn,
  ]);

  useEffect(() => {
    syncActiveStreamConversationState({
      screenSharing,
      channelId,
      activeVoiceChannel,
      activeRemoteStreamer,
      streamConversationMatchesActiveVoice,
      conversationType: conversation?.type,
      conversationId: conversation?.id,
      setConversationFn,
      setConversationNameFn,
    });
  }, [
    screenSharing,
    channelId,
    activeVoiceChannel,
    activeRemoteStreamer,
    streamConversationMatchesActiveVoice,
    conversation?.type,
    conversation?.id,
    setConversationFn,
    setConversationNameFn,
  ]);

  useEffect(() => {
    syncPiPVisibilityState({
      conversationType: conversation?.type,
      screenSharing,
      channelId,
      voiceChannels,
      prevConversationTypeRef,
      setShowPiPFn,
    });
  }, [
    conversation?.type,
    screenSharing,
    channelId,
    voiceChannels,
    prevConversationTypeRef,
    setShowPiPFn,
  ]);

  useEffect(() => {
    return bindRoomLifecycle({
      socket,
      conversation,
      clearConversationFn,
      setConversationNameFn,
    });
  }, [socket, conversation, clearConversationFn, setConversationNameFn]);

  useEffect(() => {
    if (conversation?.type === 'room' || conversation?.type === 'dm') {
      return;
    }
    clearConversationPerfTraceFn?.('non-chat-auto-nav');
  }, [conversation?.type, clearConversationPerfTraceFn]);

  useEffect(() => {
    syncJoinedVoiceConversationState({
      channelId,
      activeVoiceChannel,
      activeRemoteStreamer,
      screenSharing,
      conversationType: conversation?.type,
      prevJoinedVoiceChannelIdRef,
      setConversationFn,
      setConversationNameFn,
    });
  }, [
    channelId,
    activeVoiceChannel,
    activeRemoteStreamer,
    screenSharing,
    conversation?.type,
    prevJoinedVoiceChannelIdRef,
    setConversationFn,
    setConversationNameFn,
  ]);
}
