import { useEffect } from 'react';

export function useMessagesHydrationEffects({
  conversation = null,
  userId = null,
  messages = [],
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  const {
    messagesRef,
    prevConvRef,
  } = refs;
  const {
    setMessagesFn = () => {},
    setHasMoreFn = () => {},
    setErrorFn = () => {},
    setLoadingFn = () => {},
  } = setters;
  const {
    hydrateConversationStateFn = () => {},
    getConversationCacheKeyFn = () => null,
    getCachedConversationStateFn = () => null,
    persistReadableConversationMessagesFn = () => {},
    persistDecryptedMessageFn = () => {},
  } = runtime;

  useEffect(() => {
    hydrateConversationStateFn({
      conversation,
      userId,
      prevConversationKey: prevConvRef.current,
      getConversationCacheKeyFn,
      getCachedConversationStateFn,
      messagesRef,
      prevConvRef,
      setMessagesFn,
      setHasMoreFn,
      setErrorFn,
      setLoadingFn,
    });
  }, [
    conversation,
    userId,
    prevConvRef,
    getConversationCacheKeyFn,
    getCachedConversationStateFn,
    messagesRef,
    setMessagesFn,
    setHasMoreFn,
    setErrorFn,
    setLoadingFn,
    hydrateConversationStateFn,
  ]);

  useEffect(() => {
    persistReadableConversationMessagesFn({
      conversation,
      userId,
      messages,
      persistDecryptedMessageFn,
    });
  }, [
    conversation,
    userId,
    messages,
    persistDecryptedMessageFn,
    persistReadableConversationMessagesFn,
  ]);
}
