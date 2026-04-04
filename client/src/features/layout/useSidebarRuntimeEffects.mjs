import { useEffect } from 'react';

import {
  applySidebarIncomingDmMessage,
  reconcileSidebarDmConversations,
} from './sidebarDmRuntime.mjs';

export function useSidebarRuntimeEffects({
  onlineUsers = [],
  rememberUsersFn = () => {},
  currentGuildImageUrl = null,
  setSidebarGuildImgFailedFn = () => {},
  setDMConversationsFn = () => {},
  mergeDMConversationMetaFn = (value) => value,
  refreshDmConversationsFn = async () => {},
  currentGuild = null,
  socket = null,
  user = null,
  rememberUserNpubFn = () => {},
  logErrorFn = () => {},
} = {}) {
  useEffect(() => {
    rememberUsersFn(onlineUsers);
  }, [onlineUsers, rememberUsersFn]);

  useEffect(() => {
    setSidebarGuildImgFailedFn(false);
  }, [currentGuildImageUrl, setSidebarGuildImgFailedFn]);

  useEffect(() => {
    setDMConversationsFn((previousConversations) => reconcileSidebarDmConversations({
      previousConversations,
      mergeDMConversationMetaFn,
    }));
  }, [mergeDMConversationMetaFn, setDMConversationsFn]);

  useEffect(() => {
    refreshDmConversationsFn().catch(logErrorFn);
  }, [currentGuild, logErrorFn, refreshDmConversationsFn]);

  useEffect(() => {
    if (!socket || !user) return undefined;

    const handleDM = (message) => {
      setDMConversationsFn((previousConversations) => applySidebarIncomingDmMessage({
        previousConversations,
        message,
        currentUserId: user.userId,
        mergeDMConversationMetaFn,
        rememberUserNpubFn,
      }));
    };

    socket.on('dm:message', handleDM);
    return () => socket.off('dm:message', handleDM);
  }, [
    mergeDMConversationMetaFn,
    rememberUserNpubFn,
    setDMConversationsFn,
    socket,
    user,
  ]);
}
