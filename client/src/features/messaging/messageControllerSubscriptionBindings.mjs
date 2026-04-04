export function buildConversationRealtimeOptions({
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
  return {
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
  };
}

export function buildConversationLifecycleOptions({
  socket,
  conversation,
  userId,
  getConversationCacheKeyFn,
  setMessagesFn,
  updateCachedConversationStateFn,
  deletePersistedMessageEntryFn,
  applyEditedConversationMessageFn,
  applyDeletedConversationMessageFn,
} = {}) {
  return {
    socket,
    conversation,
    userId,
    getConversationCacheKeyFn,
    setMessagesFn,
    updateCachedConversationStateFn,
    deletePersistedMessageEntryFn,
    applyEditedConversationMessageFn,
    applyDeletedConversationMessageFn,
  };
}
