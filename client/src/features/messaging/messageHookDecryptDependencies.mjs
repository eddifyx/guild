export function createTryDecryptMessage({
  tryDecryptConversationMessageFn = async () => null,
  isE2EInitializedFn = () => false,
  getCachedDecryptedMessageFn = () => null,
  loadPersistedDecryptedMessageFn = async () => null,
  rememberUserNpubFn = () => {},
  decryptGroupMessageFn = async () => null,
  decryptDirectMessageFn = async () => null,
  persistDecryptedMessageFn = () => {},
  flushPendingControlMessagesNowFn = () => {},
  syncRoomSenderKeysFn = () => {},
  requestRoomSenderKeyFn = () => {},
  reportDecryptFailureFn = () => {},
  windowObj = null,
} = {}) {
  return async function tryDecryptMessage(msg, userId, retryState = null, options = {}) {
    return tryDecryptConversationMessageFn({
      message: msg,
      userId,
      retryState,
      options,
      isE2EInitializedFn,
      getCachedDecryptedMessageFn,
      loadPersistedDecryptedMessageFn,
      rememberUserNpubFn,
      decryptGroupMessageFn,
      decryptDirectMessageFn,
      persistDecryptedMessageFn,
      flushPendingControlMessagesNowFn,
      syncRoomSenderKeysFn,
      requestRoomSenderKeyFn,
      reportDecryptFailureFn: ({ message, error, quiet }) => {
        reportDecryptFailureFn({ message, error, quiet });
      },
      windowObj,
    });
  };
}

export function createDecryptMessages({
  decryptConversationMessagesFn = async () => [],
  isE2EInitializedFn = () => false,
  getCachedDecryptedMessageFn = () => null,
  loadPersistedDecryptedMessageFn = async () => null,
  loadPersistedDecryptedMessagesFn = async () => [],
  rememberUserNpubFn = () => {},
  decryptGroupMessageFn = async () => null,
  decryptDirectMessageFn = async () => null,
  persistDecryptedMessageFn = () => {},
  flushPendingControlMessagesNowFn = () => {},
  syncRoomSenderKeysFn = () => {},
  requestRoomSenderKeyFn = () => {},
  reportDecryptFailureFn = () => {},
  windowObj = null,
} = {}) {
  return async function decryptMessages(msgs, userId, options = {}) {
    return decryptConversationMessagesFn({
      messages: msgs,
      userId,
      options,
      isE2EInitializedFn,
      getCachedDecryptedMessageFn,
      loadPersistedDecryptedMessageFn,
      loadPersistedDecryptedMessagesFn,
      rememberUserNpubFn,
      decryptGroupMessageFn,
      decryptDirectMessageFn,
      persistDecryptedMessageFn,
      flushPendingControlMessagesNowFn,
      syncRoomSenderKeysFn,
      requestRoomSenderKeyFn,
      reportDecryptFailureFn: ({ message, error, quiet }) => {
        reportDecryptFailureFn({ message, error, quiet });
      },
      windowObj,
    });
  };
}
