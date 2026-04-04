export function buildMessageSendActionOptions({
  socket,
  conversation,
  user,
  hasMore,
  pendingSentMessagesRef,
  isConversationActiveFn,
  isE2EInitializedFn,
  hasKnownNpubFn,
  encryptGroupMessageFn,
  encryptDirectMessageFn,
  getConversationCacheKeyFn,
  createConversationTimestampFn,
  appendOrReplaceMessageFn,
  updateCachedConversationStateFn,
  sanitizeCachedAttachmentsFn,
  persistDecryptedMessageFn,
  revokeAttachmentPreviewUrlsFn,
  setMessages,
  createLocalId,
  setTimeoutFn,
  clearTimeoutFn,
} = {}) {
  return {
    socket,
    conversation,
    user,
    hasMore,
    pendingSentMessagesRef,
    isConversationActiveFn,
    isE2EInitializedFn,
    hasKnownNpubFn,
    encryptGroupMessageFn,
    encryptDirectMessageFn,
    getConversationCacheKeyFn,
    createConversationTimestampFn,
    appendOrReplaceMessageFn,
    updateCachedConversationStateFn,
    sanitizeCachedAttachmentsFn,
    persistDecryptedMessageFn,
    revokeAttachmentPreviewUrlsFn,
    setMessages,
    createLocalId,
    setTimeoutFn,
    clearTimeoutFn,
  };
}

export function buildLoadMoreMessagesActionOptions({
  conversation,
  messages,
  loading,
  hasMore,
  userId,
  isConversationActiveFn,
  getConversationCacheKeyFn,
  fetchConversationMessagesFn,
  prependOlderMessagesFn,
  cacheConversationStateFn,
  setLoadingFn,
  setHasMoreFn,
  setMessagesFn,
  errorFn,
} = {}) {
  return {
    conversation,
    messages,
    loading,
    hasMore,
    userId,
    isConversationActiveFn,
    getConversationCacheKeyFn,
    fetchConversationMessagesFn,
    prependOlderMessagesFn,
    cacheConversationStateFn,
    setLoadingFn,
    setHasMoreFn,
    setMessagesFn,
    errorFn,
  };
}

export function buildMessageMutationOptions({
  socket,
  messages,
  warnFn = () => {},
} = {}) {
  return {
    editOptions: {
      socket,
      messages,
      warnFn,
    },
    deleteOptions: {
      socket,
      warnFn,
    },
  };
}
