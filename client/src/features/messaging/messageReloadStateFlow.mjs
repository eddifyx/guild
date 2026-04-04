export function handleUnsupportedConversationReload({
  conversation,
  conversationKey,
  isConversationActiveFn = () => true,
  setMessagesFn = () => {},
  setHasMoreFn = () => {},
  setErrorFn = () => {},
  setLoadingFn = () => {},
  dmUnavailableError = 'Direct messages are only available while you share a guild with this user.',
} = {}) {
  if (conversation?.type !== 'dm' || !conversation?.dmUnsupported) {
    return null;
  }

  if (isConversationActiveFn(conversationKey)) {
    setMessagesFn([]);
    setHasMoreFn(false);
    setErrorFn(dmUnavailableError);
    setLoadingFn(false);
  }

  return { skipped: true, reason: 'dm-unsupported', conversationKey };
}

export function getCurrentConversationMessageCount({
  currentMessages = [],
  conversation,
  userId,
  messageBelongsToConversationFn = () => false,
} = {}) {
  return (currentMessages || []).filter((message) => (
    messageBelongsToConversationFn(message, conversation, userId)
  )).length;
}

export function commitReloadedConversationState({
  conversation,
  decrypted = [],
  nextHasMore = false,
  userId = null,
  setErrorFn = () => {},
  setHasMoreFn = () => {},
  setMessagesFn = () => {},
  cacheConversationStateFn = () => {},
  replaceMessagesFromSnapshotFn = (_previousMessages, nextMessages) => nextMessages,
  mergeMessagesByIdFn = (_previousMessages, nextMessages) => nextMessages,
} = {}) {
  setErrorFn('');
  setHasMoreFn(nextHasMore);
  setMessagesFn((previousMessages) => {
    const nextMessages = conversation?.type === 'room'
      ? replaceMessagesFromSnapshotFn(previousMessages, decrypted)
      : mergeMessagesByIdFn(previousMessages, decrypted);
    cacheConversationStateFn(conversation, nextMessages, nextHasMore, userId);
    return nextMessages;
  });
}
