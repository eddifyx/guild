import { useEffect } from 'react';

export function useMessagesLifecycleSubscriptionEffects({
  socket = null,
  conversation = null,
  userId = null,
  setters = {},
  runtime = {},
} = {}) {
  const {
    setMessagesFn = () => {},
  } = setters;
  const {
    getConversationCacheKeyFn = () => null,
    subscribeConversationLifecycleFn = () => () => {},
    buildConversationLifecycleOptionsFn = (value) => value,
    updateCachedConversationStateFn = () => {},
    deletePersistedMessageEntryFn = () => {},
    applyEditedConversationMessageFn = () => {},
    applyDeletedConversationMessageFn = () => {},
  } = runtime;

  useEffect(() => {
    return subscribeConversationLifecycleFn(buildConversationLifecycleOptionsFn({
      socket,
      conversation,
      userId,
      getConversationCacheKeyFn,
      setMessagesFn,
      updateCachedConversationStateFn,
      deletePersistedMessageEntryFn,
      applyEditedConversationMessageFn,
      applyDeletedConversationMessageFn,
    }));
  }, [
    socket,
    conversation,
    userId,
    getConversationCacheKeyFn,
    setMessagesFn,
    updateCachedConversationStateFn,
    deletePersistedMessageEntryFn,
    applyEditedConversationMessageFn,
    applyDeletedConversationMessageFn,
    buildConversationLifecycleOptionsFn,
    subscribeConversationLifecycleFn,
  ]);
}
