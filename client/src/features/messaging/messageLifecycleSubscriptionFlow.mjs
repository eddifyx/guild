export function subscribeConversationLifecycle({
  socket,
  conversation,
  userId,
  getConversationCacheKeyFn,
  setMessagesFn,
  updateCachedConversationStateFn,
  deletePersistedMessageEntryFn,
  applyEditedConversationMessageFn,
  applyDeletedConversationMessageFn,
} = {}) {
  if (!socket || !conversation) return () => {};

  const conversationKey = getConversationCacheKeyFn?.(conversation, userId);

  const handleEdited = ({ messageId, content, edited_at }) => {
    applyEditedConversationMessageFn?.({
      messageId,
      content,
      editedAt: edited_at,
      conversationKey,
      setMessagesFn,
      updateCachedConversationStateFn,
    });
  };

  const handleDeleted = ({ messageId }) => {
    applyDeletedConversationMessageFn?.({
      messageId,
      userId,
      conversationKey,
      deletePersistedMessageEntryFn,
      setMessagesFn,
      updateCachedConversationStateFn,
    });
  };

  socket.on('message:edited', handleEdited);
  socket.on('message:deleted', handleDeleted);
  return () => {
    socket.off('message:edited', handleEdited);
    socket.off('message:deleted', handleDeleted);
  };
}
