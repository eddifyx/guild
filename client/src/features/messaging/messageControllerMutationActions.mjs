import {
  buildLoadMoreMessagesActionOptions,
  buildMessageMutationOptions,
  buildMessageSendActionOptions,
} from './messageControllerBindings.mjs';

export function createMessageControllerMutationActions({
  socket,
  conversation,
  user,
  messages,
  loading,
  hasMore,
  userId,
  pendingSentMessagesRef,
  prevConvRef,
  setLoadingFn,
  setMessagesFn,
  setHasMoreFn,
  flows,
  windowObject = globalThis.window,
  consoleWarnFn = () => {},
  consoleErrorFn = () => {},
  cacheConversationStateFn,
} = {}) {
  const isConversationActiveFn = (conversationKey) => prevConvRef.current === conversationKey;

  async function sendMessage(content, attachments = null) {
    return flows.createMessageSendActionFn(buildMessageSendActionOptions({
      socket,
      conversation,
      user,
      hasMore,
      pendingSentMessagesRef,
      isConversationActiveFn,
      isE2EInitializedFn: flows.isE2EInitializedFn,
      hasKnownNpubFn: flows.hasKnownNpubFn,
      encryptGroupMessageFn: flows.encryptGroupMessageFn,
      encryptDirectMessageFn: flows.encryptDirectMessageFn,
      getConversationCacheKeyFn: flows.getConversationCacheKeyFn,
      createConversationTimestampFn: flows.createConversationTimestampFn,
      appendOrReplaceMessageFn: flows.appendOrReplaceMessageFn,
      updateCachedConversationStateFn: flows.updateCachedConversationStateFn,
      sanitizeCachedAttachmentsFn: flows.sanitizeCachedAttachmentsFn,
      persistDecryptedMessageFn: flows.persistDecryptedMessageFn,
      revokeAttachmentPreviewUrlsFn: flows.revokeAttachmentPreviewUrlsFn,
      setMessages: setMessagesFn,
      createLocalId: () => (
        windowObject.crypto?.randomUUID?.()
        || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      ),
      setTimeoutFn: windowObject.setTimeout.bind(windowObject),
      clearTimeoutFn: windowObject.clearTimeout.bind(windowObject),
    }))(content, attachments);
  }

  async function loadMore() {
    return flows.createLoadMoreMessagesActionFn(buildLoadMoreMessagesActionOptions({
      conversation,
      messages,
      loading,
      hasMore,
      userId,
      isConversationActiveFn,
      getConversationCacheKeyFn: flows.getConversationCacheKeyFn,
      fetchConversationMessagesFn: flows.fetchConversationMessagesFn,
      prependOlderMessagesFn: flows.prependOlderMessagesFn,
      cacheConversationStateFn,
      setLoadingFn,
      setHasMoreFn,
      setMessagesFn,
      errorFn: consoleErrorFn,
    }))();
  }

  function editMessage(messageId, content) {
    const { editOptions } = buildMessageMutationOptions({
      socket,
      messages,
      warnFn: consoleWarnFn,
    });
    return flows.createEditMessageActionFn(editOptions)(messageId, content);
  }

  function deleteMessage(messageId) {
    const { deleteOptions } = buildMessageMutationOptions({
      socket,
      warnFn: consoleWarnFn,
    });
    return flows.createDeleteMessageActionFn(deleteOptions)(messageId);
  }

  return {
    sendMessage,
    loadMore,
    editMessage,
    deleteMessage,
  };
}
