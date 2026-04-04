import {
  MESSAGE_SEND_TIMEOUT_MS,
  createAckEmitter,
} from './messageSendAckFlow.mjs';
import {
  buildSecureAttachmentState,
  createOptimisticSecureMessage,
  removeOptimisticMessageByNonce,
} from './messageSendStateFlow.mjs';

export { MESSAGE_SEND_TIMEOUT_MS };

export const DM_UNAVAILABLE_ERROR = 'Direct messages are only available while you share a guild with this user.';

export function createMessageSendAction({
  socket = null,
  conversation = null,
  user = null,
  hasMore = true,
  pendingSentMessagesRef = { current: new Map() },
  isConversationActiveFn = () => true,
  isE2EInitializedFn = () => false,
  hasKnownNpubFn = () => false,
  encryptGroupMessageFn = async () => '',
  encryptDirectMessageFn = async () => '',
  getConversationCacheKeyFn = () => null,
  createConversationTimestampFn = () => new Date().toISOString(),
  appendOrReplaceMessageFn = (messages, incomingMessage) => [...(messages || []), incomingMessage],
  updateCachedConversationStateFn = () => {},
  sanitizeCachedAttachmentsFn = (attachments) => attachments,
  persistDecryptedMessageFn = () => {},
  revokeAttachmentPreviewUrlsFn = () => {},
  setMessages = () => {},
  createLocalId = () => `local-${Date.now()}`,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  const emitWithAck = createAckEmitter({
    socket,
    setTimeoutFn,
    clearTimeoutFn,
  });

  return async function sendMessage(content, attachments = null) {
    if (!socket || !conversation) return;

    if (conversation.type === 'dm' && conversation.dmUnsupported) {
      throw new Error(DM_UNAVAILABLE_ERROR);
    }
    if (!isE2EInitializedFn()) {
      throw new Error('End-to-end encryption is not ready yet. Messages stay locked until secure startup succeeds.');
    }
    if (conversation.type === 'dm' && !hasKnownNpubFn(conversation.id)) {
      throw new Error('Secure messaging is waiting for this contact\'s Nostr identity.');
    }

    const {
      encryptedAttachmentMeta,
      attachmentRefs,
      pendingAttachments,
    } = buildSecureAttachmentState(attachments);

    const clientNonce = createLocalId();
    const conversationKey = getConversationCacheKeyFn(conversation, user?.userId);
    const pendingEntry = {
      clientNonce,
      content,
      attachments: pendingAttachments,
    };
    const optimisticMessage = createOptimisticSecureMessage({
      clientNonce,
      content,
      pendingAttachments,
      conversation,
      user,
      createConversationTimestampFn,
    });

    pendingSentMessagesRef.current.set(clientNonce, pendingEntry);
    setMessages((previousMessages) => {
      const nextMessages = appendOrReplaceMessageFn(previousMessages, optimisticMessage);
      updateCachedConversationStateFn(conversationKey, (cached) => ({
        messages: nextMessages,
        hasMore: cached?.hasMore ?? hasMore,
      }));
      return nextMessages;
    });

    try {
      const isRoom = conversation.type === 'room';
      const encrypted = isRoom
        ? await encryptGroupMessageFn(conversation.id, content, encryptedAttachmentMeta)
        : await encryptDirectMessageFn(conversation.id, content, encryptedAttachmentMeta);

      const response = await emitWithAck(
        isRoom ? 'room:message' : 'dm:message',
        isRoom
          ? {
              roomId: conversation.id,
              content: encrypted,
              attachments: attachmentRefs,
              encrypted: true,
              clientNonce,
            }
          : {
              toUserId: conversation.id,
              content: encrypted,
              attachments: attachmentRefs,
              encrypted: true,
              clientNonce,
            }
      );

      if (!response?.messageId) {
        return;
      }

      const resolvedAttachments = sanitizeCachedAttachmentsFn(pendingEntry.attachments);
      pendingSentMessagesRef.current.delete(clientNonce);
      revokeAttachmentPreviewUrlsFn(pendingEntry.attachments);
      persistDecryptedMessageFn(
        { id: response.messageId, encrypted: true, content: encrypted },
        content,
        resolvedAttachments,
        user?.userId
      );

      const finalizedMessage = {
        ...optimisticMessage,
        id: response.messageId,
        _optimistic: false,
        _ciphertextContent: encrypted,
        _decryptedAttachments: resolvedAttachments,
      };

      updateCachedConversationStateFn(conversationKey, (cached) => ({
        messages: appendOrReplaceMessageFn(cached?.messages || [], finalizedMessage),
        hasMore: cached?.hasMore ?? hasMore,
      }));

      if (isConversationActiveFn(conversationKey)) {
        setMessages((previousMessages) => appendOrReplaceMessageFn(previousMessages, finalizedMessage));
      }
    } catch (err) {
      pendingSentMessagesRef.current.delete(clientNonce);
      updateCachedConversationStateFn(conversationKey, (cached) => cached ? {
        messages: removeOptimisticMessageByNonce(cached.messages, clientNonce),
        hasMore: cached.hasMore,
      } : null);
      if (isConversationActiveFn(conversationKey)) {
        setMessages((previousMessages) => removeOptimisticMessageByNonce(previousMessages, clientNonce));
      }
      throw err;
    }
  };
}
