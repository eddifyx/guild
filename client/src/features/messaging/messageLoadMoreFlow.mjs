export function createLoadMoreMessagesAction({
  conversation = null,
  messages = [],
  loading = false,
  hasMore = true,
  userId = null,
  isConversationActiveFn = () => true,
  getConversationCacheKeyFn = () => null,
  fetchConversationMessagesFn = async () => ({ messages: [], hasMore: false }),
  prependOlderMessagesFn = (_previousMessages, nextMessages) => nextMessages,
  cacheConversationStateFn = () => {},
  setLoadingFn = () => {},
  setHasMoreFn = () => {},
  setMessagesFn = () => {},
  errorFn = () => {},
} = {}) {
  return async function loadMore() {
    if (!conversation || !messages.length || loading || !hasMore) return;

    const conversationKey = getConversationCacheKeyFn(conversation, userId);
    const oldestMessage = messages[0];
    setLoadingFn(true);

    try {
      const {
        messages: decryptedMessages,
        hasMore: nextHasMore,
      } = await fetchConversationMessagesFn(conversation, userId, {
        before: oldestMessage?.created_at,
        limit: 50,
      });

      if (!isConversationActiveFn(conversationKey)) {
        return;
      }

      setHasMoreFn(nextHasMore);
      setMessagesFn((previousMessages) => {
        const nextMessages = prependOlderMessagesFn(previousMessages, decryptedMessages);
        cacheConversationStateFn(conversation, nextMessages, nextHasMore, userId);
        return nextMessages;
      });
    } catch (err) {
      errorFn('Failed to load more messages:', err);
    } finally {
      if (isConversationActiveFn(conversationKey)) {
        setLoadingFn(false);
      }
    }
  };
}
