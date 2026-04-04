import { useEffect } from 'react';

export function useMessagesRetryBindingEffects({
  conversation = null,
  userId = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  actions = {},
  runtime = {},
} = {}) {
  const {
    retryFailedVisibleRoomMessagesRef,
  } = refs;
  const {
    setMessagesFn = () => {},
  } = setters;
  const {
    retryFailedVisibleMessagesFn = async () => {},
    retryFailedVisibleRoomMessagesFn = async () => {},
  } = actions;
  const {
    bindDMDecryptRetryFn = () => () => {},
    bindRoomSenderKeyRetryFn = () => () => {},
    windowObj = null,
    schedulePendingDecryptExpiryFn = () => () => {},
    visibleTimeoutMs = 0,
    getPendingDecryptVisibilityDelayFn = () => 0,
    expirePendingDecryptMessagesFn = () => [],
    cacheConversationStateFn = () => {},
  } = runtime;

  useEffect(() => {
    retryFailedVisibleRoomMessagesRef.current = retryFailedVisibleRoomMessagesFn;
  }, [retryFailedVisibleRoomMessagesFn, retryFailedVisibleRoomMessagesRef]);

  useEffect(() => {
    return bindDMDecryptRetryFn({
      conversation,
      retryFailedVisibleMessagesFn,
      windowObj,
    });
  }, [conversation, retryFailedVisibleMessagesFn, windowObj, bindDMDecryptRetryFn]);

  useEffect(() => {
    return bindRoomSenderKeyRetryFn({
      conversation,
      retryFailedVisibleRoomMessagesFn,
      windowObj,
    });
  }, [conversation, retryFailedVisibleRoomMessagesFn, windowObj, bindRoomSenderKeyRetryFn]);

  useEffect(() => {
    return schedulePendingDecryptExpiryFn({
      messages,
      conversation,
      hasMore,
      userId,
      visibleTimeoutMs,
      getPendingDecryptVisibilityDelayFn,
      expirePendingDecryptMessagesFn,
      setMessagesFn,
      cacheConversationStateFn,
      windowObj,
    });
  }, [
    messages,
    conversation,
    hasMore,
    userId,
    visibleTimeoutMs,
    getPendingDecryptVisibilityDelayFn,
    expirePendingDecryptMessagesFn,
    setMessagesFn,
    cacheConversationStateFn,
    windowObj,
    schedulePendingDecryptExpiryFn,
  ]);
}
