export function applyEditedConversationMessage({
  messageId = null,
  content = null,
  editedAt = null,
  conversationKey = null,
  setMessagesFn = () => {},
  updateCachedConversationStateFn = () => {},
} = {}) {
  setMessagesFn((previousMessages) => {
    const nextMessages = (previousMessages || []).map((message) => {
      if (message?.id !== messageId) return message;
      if (message?._decrypted) {
        return { ...message, edited_at: editedAt };
      }
      return { ...message, content, edited_at: editedAt };
    });
    updateCachedConversationStateFn(conversationKey, (cached) => cached ? {
      messages: nextMessages,
      hasMore: cached.hasMore,
    } : null);
    return nextMessages;
  });
}

export function applyDeletedConversationMessage({
  messageId = null,
  userId = null,
  conversationKey = null,
  deletePersistedMessageEntryFn = () => {},
  setMessagesFn = () => {},
  updateCachedConversationStateFn = () => {},
} = {}) {
  deletePersistedMessageEntryFn(userId, messageId);
  setMessagesFn((previousMessages) => {
    const nextMessages = (previousMessages || []).filter((message) => message?.id !== messageId);
    updateCachedConversationStateFn(conversationKey, (cached) => cached ? {
      messages: nextMessages,
      hasMore: cached.hasMore,
    } : null);
    return nextMessages;
  });
}
