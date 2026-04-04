import { useCallback } from 'react';

export function useMessagesControllerSupportRuntime({
  refs = {},
  windowObject = globalThis.window || globalThis,
} = {}) {
  const {
    pendingSentMessagesRef,
    messagesRef,
    prevConvRef,
    retryFailedVisibleRoomMessagesRef,
    deferredRoomSenderKeySyncTimeoutRef,
  } = refs;

  const clearDeferredRoomSenderKeySync = useCallback(() => {
    if (!deferredRoomSenderKeySyncTimeoutRef?.current) return;
    windowObject.clearTimeout(deferredRoomSenderKeySyncTimeoutRef.current);
    deferredRoomSenderKeySyncTimeoutRef.current = null;
  }, [deferredRoomSenderKeySyncTimeoutRef, windowObject]);

  return {
    refs: {
      pendingSentMessagesRef,
      messagesRef,
      prevConvRef,
      retryFailedVisibleRoomMessagesRef,
      deferredRoomSenderKeySyncTimeoutRef,
    },
    clearDeferredRoomSenderKeySync,
  };
}
