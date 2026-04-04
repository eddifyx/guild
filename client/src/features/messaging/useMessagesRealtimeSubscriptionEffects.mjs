import { useEffect } from 'react';

export function useMessagesRealtimeSubscriptionEffects({
  socket = null,
  conversation = null,
  userId = null,
  hasMore = true,
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  const {
    pendingSentMessagesRef,
  } = refs;
  const {
    setMessagesFn = () => {},
  } = setters;
  const {
    getConversationCacheKeyFn = () => null,
    subscribeConversationRealtimeFn = () => () => {},
    buildConversationRealtimeOptionsFn = (value) => value,
    tryDecryptMessageFn = async () => null,
    appendOrReplaceMessageFn = () => [],
    updateCachedConversationStateFn = () => {},
    sanitizeCachedAttachmentsFn = (value) => value,
    revokeAttachmentPreviewUrlsFn = () => {},
    persistDecryptedMessageFn = () => {},
    processIncomingConversationMessageFn = () => {},
  } = runtime;

  useEffect(() => {
    if (!socket || !conversation) return;
    return subscribeConversationRealtimeFn(buildConversationRealtimeOptionsFn({
      socket,
      conversation,
      userId,
      hasMore,
      pendingSentMessages: pendingSentMessagesRef.current,
      setMessagesFn,
      tryDecryptMessageFn,
      appendOrReplaceMessageFn,
      updateCachedConversationStateFn,
      getConversationCacheKeyFn,
      sanitizeCachedAttachmentsFn,
      revokeAttachmentPreviewUrlsFn,
      persistDecryptedMessageFn,
      processIncomingConversationMessageFn,
    }));
  }, [
    socket,
    conversation,
    userId,
    hasMore,
    pendingSentMessagesRef,
    setMessagesFn,
    tryDecryptMessageFn,
    appendOrReplaceMessageFn,
    updateCachedConversationStateFn,
    getConversationCacheKeyFn,
    sanitizeCachedAttachmentsFn,
    revokeAttachmentPreviewUrlsFn,
    persistDecryptedMessageFn,
    processIncomingConversationMessageFn,
    buildConversationRealtimeOptionsFn,
    subscribeConversationRealtimeFn,
  ]);
}
