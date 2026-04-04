import { useEffect } from 'react';

export function useMessagesResetEffects({
  userId = null,
  messages = [],
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  const {
    messagesRef,
    prevConvRef,
    pendingSentMessagesRef,
  } = refs;
  const {
    setMessagesFn = () => {},
    setHasMoreFn = () => {},
    setErrorFn = () => {},
    setLoadingFn = () => {},
  } = setters;
  const {
    clearDeferredRoomSenderKeySyncFn = () => {},
    clearAllMessageCachesFn = () => {},
    revokeAttachmentPreviewUrlsFn = () => {},
    resetMessageLaneStateFn = () => {},
  } = runtime;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages, messagesRef]);

  useEffect(() => {
    resetMessageLaneStateFn({
      pendingSentMessages: pendingSentMessagesRef.current,
      clearAllMessageCachesFn,
      revokeAttachmentPreviewUrlsFn,
      clearDeferredRoomSenderKeySyncFn,
      messagesRef,
      prevConvRef,
      setMessagesFn,
      setHasMoreFn,
      setErrorFn,
      setLoadingFn,
    });
  }, [
    userId,
    pendingSentMessagesRef,
    clearAllMessageCachesFn,
    revokeAttachmentPreviewUrlsFn,
    clearDeferredRoomSenderKeySyncFn,
    messagesRef,
    prevConvRef,
    setMessagesFn,
    setHasMoreFn,
    setErrorFn,
    setLoadingFn,
    resetMessageLaneStateFn,
  ]);

  useEffect(() => () => {
    clearDeferredRoomSenderKeySyncFn();
  }, [clearDeferredRoomSenderKeySyncFn]);
}
