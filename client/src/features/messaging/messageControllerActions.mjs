import {
  createMessageControllerMutationActions,
} from './messageControllerMutationActions.mjs';
import {
  createMessageControllerReloadActions,
} from './messageControllerReloadActions.mjs';

export function createMessageControllerActions({
  socket,
  conversation,
  user,
  userId,
  messages,
  loading,
  hasMore,
  perfTraceId = null,
  pendingSentMessagesRef,
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
  consoleWarnFn = () => {},
  consoleErrorFn = () => {},
} = {}) {
  const cacheConversationStateFn = (nextConversation, nextMessages, nextHasMore, nextUserId) => (
    flows.cacheConversationStateFn(nextConversation, nextMessages, nextHasMore, nextUserId, {
      sortMessagesChronologicallyFn: flows.sortMessagesChronologicallyFn,
    })
  );

  const reloadActions = createMessageControllerReloadActions({
    conversation,
    userId,
    hasMore,
    perfTraceId,
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
    windowObject,
    consoleErrorFn,
    cacheConversationStateFn,
  });

  const mutationActions = createMessageControllerMutationActions({
    socket,
    conversation,
    user,
    messages,
    loading,
    hasMore,
    userId,
    pendingSentMessagesRef,
    prevConvRef,
    setLoadingFn,
    setMessagesFn,
    setHasMoreFn,
    flows,
    windowObject,
    consoleWarnFn,
    consoleErrorFn,
    cacheConversationStateFn,
  });

  return {
    ...reloadActions,
    ...mutationActions,
  };
}
