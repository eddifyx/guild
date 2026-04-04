import {
  commitReloadedConversationState,
  getCurrentConversationMessageCount,
  handleUnsupportedConversationReload,
} from './messageReloadStateFlow.mjs';
import {
  DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS,
  scheduleDeferredRoomSenderKeySync,
} from './messageReloadDeferredSyncFlow.mjs';

export { DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS };

export async function runMessageReloadFlow({
  conversation = null,
  userId = null,
  perfTraceId = null,
  currentMessages = [],
  clearDeferredRoomSenderKeySyncFn = () => {},
  isConversationActiveFn = () => true,
  getConversationCacheKeyFn = () => null,
  messageBelongsToConversationFn = () => false,
  setLoadingFn = () => {},
  setMessagesFn = () => {},
  setHasMoreFn = () => {},
  setErrorFn = () => {},
  fetchConversationMessagesFn = async () => ({ messages: [], hasMore: false, roomSenderKeySyncPromise: null }),
  cacheConversationStateFn = () => {},
  replaceMessagesFromSnapshotFn = (_previousMessages, nextMessages) => nextMessages,
  mergeMessagesByIdFn = (_previousMessages, nextMessages) => nextMessages,
  debugRoomOpenLogFn = () => {},
  addPerfPhaseFn = () => {},
  syncConversationRoomSenderKeysFn = async () => {},
  retryFailedVisibleRoomMessagesFn = async () => {},
  setDeferredRoomSenderKeySyncHandleFn = () => {},
  setTimeoutFn = setTimeout,
  nowFn = () => Date.now(),
  warnFn = () => {},
  dmUnavailableError = 'Direct messages are only available while you share a guild with this user.',
} = {}) {
  if (!conversation) return;

  clearDeferredRoomSenderKeySyncFn();

  const conversationKey = getConversationCacheKeyFn(conversation, userId);
  const unsupportedResult = handleUnsupportedConversationReload({
    conversation,
    conversationKey,
    isConversationActiveFn,
    setMessagesFn,
    setHasMoreFn,
    setErrorFn,
    setLoadingFn,
    dmUnavailableError,
  });
  if (unsupportedResult) {
    return unsupportedResult;
  }

  const currentConversationMessageCount = getCurrentConversationMessageCount({
    currentMessages,
    conversation,
    userId,
    messageBelongsToConversationFn,
  });
  const shouldShowInitialLoader = currentConversationMessageCount === 0;
  if (shouldShowInitialLoader) {
    setLoadingFn(true);
  }

  const reloadStartedAt = nowFn();

  try {
    const useFastRoomOpen = conversation.type === 'room';
    if (conversation.type === 'room') {
      debugRoomOpenLogFn('reload-start', {
        roomId: conversation.id,
        cachedMessageCount: currentConversationMessageCount,
        fastRoomOpen: useFastRoomOpen,
      });
    }

    addPerfPhaseFn(perfTraceId, 'messages:reload-start', {
      cachedMessageCount: currentConversationMessageCount,
      fastRoomOpen: useFastRoomOpen,
    });

    const {
      messages: decrypted,
      hasMore: nextHasMore,
      roomSenderKeySyncPromise,
    } = await fetchConversationMessagesFn(conversation, userId, {
      limit: 50,
      fastRoomOpen: useFastRoomOpen,
    });

    if (conversation.type === 'room') {
      debugRoomOpenLogFn('fetch-ready', {
        roomId: conversation.id,
        durationMs: nowFn() - reloadStartedAt,
        fetchedMessageCount: decrypted.length,
        hasMore: nextHasMore,
      });
    }

    if (!isConversationActiveFn(conversationKey)) {
      return { skipped: true, reason: 'conversation-changed', conversationKey };
    }

    commitReloadedConversationState({
      conversation,
      decrypted,
      nextHasMore,
      userId,
      setErrorFn,
      setHasMoreFn,
      setMessagesFn,
      cacheConversationStateFn,
      replaceMessagesFromSnapshotFn,
      mergeMessagesByIdFn,
    });

    if (conversation.type === 'room') {
      debugRoomOpenLogFn('messages-committed', {
        roomId: conversation.id,
        durationMs: nowFn() - reloadStartedAt,
      });
    }

    addPerfPhaseFn(perfTraceId, 'messages:reload-ready', {
      fetchedMessageCount: decrypted.length,
      hasMore: nextHasMore,
    });

    scheduleDeferredRoomSenderKeySync({
      conversation,
      conversationKey,
      perfTraceId,
      reloadStartedAt,
      roomSenderKeySyncPromise,
      isConversationActiveFn,
      debugRoomOpenLogFn,
      addPerfPhaseFn,
      syncConversationRoomSenderKeysFn,
      retryFailedVisibleRoomMessagesFn,
      setDeferredRoomSenderKeySyncHandleFn,
      setTimeoutFn,
      nowFn,
      warnFn,
    });

    return {
      skipped: false,
      conversationKey,
      hasMore: nextHasMore,
      fetchedMessageCount: decrypted.length,
    };
  } catch (err) {
    addPerfPhaseFn(perfTraceId, 'messages:reload-error', {
      error: err?.message || 'Failed to fetch messages',
    });

    if (isConversationActiveFn(conversationKey)) {
      setErrorFn(err?.message || 'Failed to fetch messages.');
      warnFn('Failed to fetch messages:', err);
    }

    return {
      skipped: false,
      conversationKey,
      error: err,
    };
  } finally {
    if (isConversationActiveFn(conversationKey)) {
      setLoadingFn(false);
    }
  }
}
