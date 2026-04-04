export function collectRetryableConversationMessages({ messages = [], conversation, userId }) {
  if (!conversation || !userId) return [];

  return messages.filter((message) => {
    if (!message?.encrypted || (!message?._decryptionFailed && !message?._decryptionPending)) {
      return false;
    }

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
  });
}

export function prioritizeRoomRecoveryMessages(
  messages,
  { getMessageTimestampValueFn, limit = 12 } = {},
) {
  const failedMessages = Array.isArray(messages) ? messages : [];
  if (failedMessages.length <= limit) return failedMessages;

  const newestFirst = [...failedMessages].sort((a, b) => (
    getMessageTimestampValueFn(b) - getMessageTimestampValueFn(a)
  ));
  const prioritized = newestFirst
    .slice(0, limit)
    .sort((a, b) => getMessageTimestampValueFn(a) - getMessageTimestampValueFn(b));
  const prioritizedIds = new Set(prioritized.map((message) => message.id));
  const remaining = failedMessages.filter((message) => !prioritizedIds.has(message.id));
  return [...prioritized, ...remaining];
}

export function shouldRetryFailedDMConversationMessages({ conversation, messages = [], userId }) {
  if (!conversation || conversation.type !== 'dm' || !userId) return false;

  return messages.some((message) => (
    !message?.room_id
    && (
      (message?.sender_id === conversation.id && message?.dm_partner_id === userId) ||
      (message?.sender_id === userId && message?.dm_partner_id === conversation.id)
    )
    && message?.encrypted
    && (message?._decryptionFailed || message?._decryptionPending)
  ));
}
