import {
  buildMessageReloadOptions,
  buildRetryFailedMessagesOptions,
} from './messageControllerBindings.mjs';

export function createMessageControllerReloadActions({
  conversation,
  userId,
  hasMore,
  perfTraceId = null,
  messagesRef,
  prevConvRef,
  retryFailedVisibleRoomMessagesRef,
  deferredRoomSenderKeySyncTimeoutRef,
  clearDeferredRoomSenderKeySyncFn,
  setLoadingFn,
  setMessagesFn,
  setHasMoreFn,
  setErrorFn,
  flows,
  windowObject = globalThis.window,
  consoleErrorFn = () => {},
  cacheConversationStateFn,
} = {}) {
  const isConversationActiveFn = (conversationKey) => (
    prevConvRef.current === conversationKey
    || prevConvRef.current === null
  );
  const currentConversationKeyFn = () => prevConvRef.current;

  async function reloadMessages() {
    await flows.runMessageReloadFlowFn(buildMessageReloadOptions({
      conversation,
      userId,
      perfTraceId,
      currentMessages: messagesRef.current,
      clearDeferredRoomSenderKeySyncFn,
      isConversationActiveFn,
      getConversationCacheKeyFn: flows.getConversationCacheKeyFn,
      messageBelongsToConversationFn: flows.messageBelongsToConversationFn,
      setLoadingFn,
      setMessagesFn,
      setHasMoreFn,
      setErrorFn,
      fetchConversationMessagesFn: flows.fetchConversationMessagesFn,
      cacheConversationStateFn,
      replaceMessagesFromSnapshotFn: flows.replaceMessagesFromSnapshotFn,
      mergeMessagesByIdFn: flows.mergeMessagesByIdFn,
      debugRoomOpenLogFn: flows.debugRoomOpenLogFn,
      addPerfPhaseFn: flows.addPerfPhaseFn,
      syncConversationRoomSenderKeysFn: flows.syncConversationRoomSenderKeysFn,
      retryFailedVisibleRoomMessagesFn: retryFailedVisibleRoomMessagesRef.current,
      setDeferredRoomSenderKeySyncHandleFn: (handle) => {
        deferredRoomSenderKeySyncTimeoutRef.current = handle;
      },
      setTimeoutFn: windowObject.setTimeout.bind(windowObject),
      warnFn: consoleErrorFn,
      dmUnavailableError: flows.dmUnavailableError,
    }));
  }

  async function retryFailedVisibleMessages({ allowRoomSenderKeyRecovery = true } = {}) {
    await flows.retryFailedConversationMessagesFn(buildRetryFailedMessagesOptions({
      conversation,
      userId,
      messages: messagesRef.current,
      hasMore,
      allowRoomSenderKeyRecovery,
      tryDecryptMessageFn: flows.tryDecryptMessageFn,
      getConversationCacheKeyFn: flows.getConversationCacheKeyFn,
      currentConversationKeyFn,
      getMessageTimestampValueFn: flows.getMessageTimestampValueFn,
      setMessagesFn,
      cacheConversationStateFn,
    }));
  }

  async function retryFailedVisibleRoomMessages(options = {}) {
    if (!conversation || conversation.type !== 'room') return;
    await retryFailedVisibleMessages(options);
  }

  return {
    reloadMessages,
    retryFailedVisibleMessages,
    retryFailedVisibleRoomMessages,
  };
}
