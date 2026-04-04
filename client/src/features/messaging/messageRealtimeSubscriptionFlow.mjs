export function subscribeConversationRealtime({
  socket,
  conversation,
  userId,
  hasMore,
  pendingSentMessages,
  setMessagesFn,
  tryDecryptMessageFn,
  appendOrReplaceMessageFn,
  updateCachedConversationStateFn,
  getConversationCacheKeyFn,
  sanitizeCachedAttachmentsFn,
  revokeAttachmentPreviewUrlsFn,
  persistDecryptedMessageFn,
  processIncomingConversationMessageFn,
} = {}) {
  if (!socket || !conversation) return () => {};

  const handler = async (message) => {
    await processIncomingConversationMessageFn?.({
      message,
      conversation,
      userId,
      hasMore,
      pendingSentMessages,
      setMessagesFn,
      tryDecryptMessageFn,
      appendOrReplaceMessageFn,
      updateCachedConversationStateFn,
      getConversationCacheKeyFn,
      sanitizeCachedAttachmentsFn,
      revokeAttachmentPreviewUrlsFn,
      persistDecryptedMessageFn,
    });
  };

  const eventName = conversation.type === 'room' ? 'room:message' : 'dm:message';
  socket.on(eventName, handler);
  return () => socket.off(eventName, handler);
}
