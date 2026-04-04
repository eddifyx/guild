import { useMessagesRuntimeEffects } from './useMessagesRuntimeEffects.mjs';

export function useMessagesControllerEffectRuntime({
  conversation = null,
  userId = null,
  socket = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  runtime = {},
  actions = {},
  clearDeferredRoomSenderKeySync = () => {},
} = {}) {
  const {
    messagesRef,
    prevConvRef,
    pendingSentMessagesRef,
    retryFailedVisibleRoomMessagesRef,
  } = refs;

  useMessagesRuntimeEffects({
    conversation,
    userId,
    socket,
    messages,
    hasMore,
    refs: {
      messagesRef,
      prevConvRef,
      pendingSentMessagesRef,
      retryFailedVisibleRoomMessagesRef,
    },
    setters,
    actions: {
      retryFailedVisibleMessagesFn: actions.retryFailedVisibleMessages,
      retryFailedVisibleRoomMessagesFn: actions.retryFailedVisibleRoomMessages,
      reloadMessagesFn: actions.reloadMessages,
    },
    runtime: {
      ...runtime,
      clearDeferredRoomSenderKeySyncFn: clearDeferredRoomSenderKeySync,
    },
  });
}
