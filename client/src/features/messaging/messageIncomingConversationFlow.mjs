export function isIncomingMessageForConversation(message, conversation, userId) {
  if (!message || !conversation || !userId) return false;

  if (conversation.type === 'room') {
    return message?.room_id === conversation.id;
  }

  if (conversation.type === 'dm') {
    return !message?.room_id && (
      (message?.sender_id === conversation.id && message?.dm_partner_id === userId) ||
      (message?.sender_id === userId && message?.dm_partner_id === conversation.id)
    );
  }

  return false;
}

export async function processIncomingConversationMessage({
  message = null,
  conversation = null,
  userId = null,
  hasMore = true,
  pendingSentMessages = new Map(),
  setMessagesFn = () => {},
  tryDecryptMessageFn = async (incomingMessage) => incomingMessage,
  appendOrReplaceMessageFn = (messages, incomingMessage) => [...(messages || []), incomingMessage],
  updateCachedConversationStateFn = () => {},
  getConversationCacheKeyFn = () => null,
  sanitizeCachedAttachmentsFn = (attachments) => attachments || [],
  revokeAttachmentPreviewUrlsFn = () => {},
  persistDecryptedMessageFn = () => {},
} = {}) {
  if (!isIncomingMessageForConversation(message, conversation, userId)) {
    return { handled: false, reason: 'not-for-conversation' };
  }

  const conversationKey = getConversationCacheKeyFn(conversation, userId);

  if (message?.encrypted && message?.sender_id === userId) {
    const pending = message?.client_nonce ? pendingSentMessages.get(message.client_nonce) : null;
    if (pending) {
      const resolvedAttachments = sanitizeCachedAttachmentsFn(pending.attachments);
      pendingSentMessages.delete(message.client_nonce);
      revokeAttachmentPreviewUrlsFn(pending.attachments);
      persistDecryptedMessageFn(message, pending.content, resolvedAttachments, userId);
      setMessagesFn((previousMessages) => {
        const nextMessages = appendOrReplaceMessageFn(previousMessages, {
          ...message,
          content: pending.content,
          _decrypted: true,
          _decryptedAttachments: resolvedAttachments,
          _ciphertextContent: message.content,
          _clientNonce: message.client_nonce || pending.clientNonce || null,
        });
        updateCachedConversationStateFn(conversationKey, (cached) => ({
          messages: nextMessages,
          hasMore: cached?.hasMore ?? hasMore,
        }));
        return nextMessages;
      });
      return { handled: true, finalizedPending: true };
    }
  }

  const decryptedMessage = await tryDecryptMessageFn(message, userId);
  setMessagesFn((previousMessages) => {
    const nextMessages = appendOrReplaceMessageFn(previousMessages, decryptedMessage);
    updateCachedConversationStateFn(conversationKey, (cached) => ({
      messages: nextMessages,
      hasMore: cached?.hasMore ?? hasMore,
    }));
    return nextMessages;
  });

  return { handled: true, finalizedPending: false };
}
