import {
  collectRetryableConversationMessages,
  prioritizeRoomRecoveryMessages,
} from './messageRecoverySelectionFlow.mjs';

export async function retryFailedConversationMessages({
  conversation,
  userId,
  messages,
  hasMore,
  allowRoomSenderKeyRecovery = true,
  tryDecryptMessageFn,
  getConversationCacheKeyFn,
  currentConversationKeyFn,
  getMessageTimestampValueFn,
  setMessagesFn,
  cacheConversationStateFn,
} = {}) {
  let failedMessages = collectRetryableConversationMessages({ messages, conversation, userId });
  if (failedMessages.length === 0) return false;

  if (conversation?.type === 'room') {
    failedMessages = prioritizeRoomRecoveryMessages(failedMessages, {
      getMessageTimestampValueFn,
    });
  }

  const retriedById = new Map();
  const roomRetryStates = new Map();
  for (const message of failedMessages) {
    let retryState = null;
    if (conversation?.type === 'room') {
      retryState = roomRetryStates.get(message.room_id);
      if (!retryState) {
        retryState = { attemptedSenderIds: new Set() };
        roomRetryStates.set(message.room_id, retryState);
      }
    }

    const retried = await tryDecryptMessageFn(message, userId, retryState, {
      quiet: true,
      allowRoomSenderKeyRecovery,
    });
    const resolvedToVisibleState = retried?._decrypted
      || retried?._decryptionFailed
      || (typeof retried?.content === 'string' && retried.content.length > 0);

    if (resolvedToVisibleState) {
      retriedById.set(message.id, retried);
    }
  }

  if (retriedById.size === 0) return false;

  const conversationKey = getConversationCacheKeyFn(conversation, userId);
  if (currentConversationKeyFn() !== conversationKey) return false;

  let updated = false;
  setMessagesFn((prev) => {
    let changed = false;
    const next = prev.map((message) => {
      const replacement = message?.id ? retriedById.get(message.id) : null;
      if (!replacement) return message;
      changed = true;
      return replacement;
    });

    if (!changed) return prev;
    updated = true;
    cacheConversationStateFn(conversation, next, hasMore, userId);
    return next;
  });

  return updated;
}
