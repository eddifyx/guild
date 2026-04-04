export function createSyncConversationRoomSenderKeys({
  syncConversationRoomSenderKeysFlowFn = async () => null,
  syncRoomSenderKeysFn = () => {},
  flushPendingControlMessagesNowFn = () => {},
} = {}) {
  return async function syncConversationRoomSenderKeys(roomId) {
    return syncConversationRoomSenderKeysFlowFn({
      roomId,
      syncRoomSenderKeysFn,
      flushPendingControlMessagesNowFn,
    });
  };
}

export function createFetchConversationMessages({
  fetchConversationMessagesFlowFn = async () => [],
  apiFn = async () => null,
  decryptMessagesFn = async () => [],
  syncConversationRoomSenderKeysFn = async () => null,
  sortMessagesChronologicallyFn = (messages) => messages,
  warnFn = () => {},
} = {}) {
  return async function fetchConversationMessages(
    conversation,
    userId,
    { before = null, limit = 50, quietDecrypt = false, fastRoomOpen = false } = {},
  ) {
    return fetchConversationMessagesFlowFn({
      conversation,
      userId,
      before,
      limit,
      quietDecrypt,
      fastRoomOpen,
      apiFn,
      decryptConversationMessagesFn: ({ messages, userId: nextUserId, options }) => (
        decryptMessagesFn(messages, nextUserId, options)
      ),
      syncConversationRoomSenderKeysFn: (roomId) => syncConversationRoomSenderKeysFn(roomId),
      sortMessagesChronologicallyFn,
      warnFn,
    });
  };
}

export function createWarmRoomMessageCache({
  warmRoomMessageCacheFlowFn = async () => null,
  roomWarmLimit = 0,
  isE2EInitializedFn = () => false,
  getCachedConversationStateFn = () => null,
  fetchConversationMessagesFn = async () => [],
  cacheConversationStateFn = () => {},
  sortMessagesChronologicallyFn = (messages) => messages,
  warnFn = () => {},
} = {}) {
  return async function warmRoomMessageCache(rooms, userId, { maxRooms = 3, concurrency = 1 } = {}) {
    return warmRoomMessageCacheFlowFn({
      rooms,
      userId,
      maxRooms,
      concurrency,
      roomWarmLimit,
      isE2EInitializedFn,
      getCachedConversationStateFn,
      fetchConversationMessagesFn: (conversation, nextUserId, options) => (
        fetchConversationMessagesFn(conversation, nextUserId, options)
      ),
      cacheConversationStateFn: (conversation, messages, hasMore, nextUserId) => (
        cacheConversationStateFn(conversation, messages, hasMore, nextUserId, {
          sortMessagesChronologicallyFn,
        })
      ),
      warnFn,
    });
  };
}
