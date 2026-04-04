export function messageBelongsToConversation(message, conversation, userId) {
  if (!message || !conversation) return false;

  if (conversation.type === 'room') {
    return message?.room_id === conversation.id;
  }

  if (conversation.type === 'dm') {
    return !message?.room_id && (
      (message?.sender_id === conversation.id && message?.dm_partner_id === userId)
      || (message?.sender_id === userId && message?.dm_partner_id === conversation.id)
    );
  }

  return false;
}

export function createConversationTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function hydrateConversationState({
  conversation,
  userId,
  prevConversationKey,
  getConversationCacheKeyFn,
  getCachedConversationStateFn,
  messagesRef,
  prevConvRef,
  setMessagesFn,
  setHasMoreFn,
  setErrorFn,
  setLoadingFn,
} = {}) {
  const nextConversationKey = getConversationCacheKeyFn?.(conversation, userId);
  if (nextConversationKey === prevConversationKey) {
    return {
      changed: false,
      conversationKey: nextConversationKey,
    };
  }

  const cached = getCachedConversationStateFn?.(conversation, userId);
  const nextMessages = cached?.messages || [];
  if (messagesRef) messagesRef.current = nextMessages;
  setMessagesFn?.(nextMessages);
  setHasMoreFn?.(cached?.hasMore ?? true);
  setErrorFn?.('');
  setLoadingFn?.(false);
  if (prevConvRef) prevConvRef.current = nextConversationKey;

  return {
    changed: true,
    conversationKey: nextConversationKey,
    messages: nextMessages,
    hasMore: cached?.hasMore ?? true,
  };
}

export function persistReadableConversationMessages({
  conversation,
  userId,
  messages,
  persistDecryptedMessageFn,
} = {}) {
  if (!conversation || !userId || !Array.isArray(messages) || messages.length === 0) return 0;

  let persistedCount = 0;
  for (const message of messages) {
    if (!message?.encrypted || !message?._decrypted || typeof message.content !== 'string') continue;
    persistDecryptedMessageFn?.(message, message.content, message._decryptedAttachments || [], userId);
    persistedCount += 1;
  }

  return persistedCount;
}
