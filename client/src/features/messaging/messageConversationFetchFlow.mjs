export async function syncConversationRoomSenderKeys({
  roomId,
  syncRoomSenderKeysFn,
  flushPendingControlMessagesNowFn,
} = {}) {
  if (!roomId) return 0;
  const syncedCount = await syncRoomSenderKeysFn?.(roomId);
  await flushPendingControlMessagesNowFn?.();
  return syncedCount || 0;
}

function buildConversationMessagesUrl(conversation, before, limit) {
  const beforeQuery = before
    ? `?before=${encodeURIComponent(before)}&limit=${limit}`
    : `?limit=${limit}`;

  return conversation?.type === 'room'
    ? `/api/messages/room/${conversation.id}${beforeQuery}`
    : `/api/messages/dm/${conversation.id}${beforeQuery}`;
}

export async function fetchConversationMessages({
  conversation,
  userId,
  before = null,
  limit = 50,
  quietDecrypt = false,
  fastRoomOpen = false,
  apiFn,
  decryptConversationMessagesFn,
  syncConversationRoomSenderKeysFn,
  sortMessagesChronologicallyFn,
  warnFn = console.warn,
} = {}) {
  if (!conversation) {
    return { messages: [], hasMore: false };
  }

  let roomSenderKeySyncPromise = null;
  if (conversation.type === 'room' && !fastRoomOpen) {
    roomSenderKeySyncPromise = syncConversationRoomSenderKeysFn?.(conversation.id).catch((error) => {
      warnFn?.('[Rooms] Sender-key sync failed while opening room:', error?.message || error);
    });
    await roomSenderKeySyncPromise;
  }

  const messages = await apiFn?.(buildConversationMessagesUrl(conversation, before, limit));
  const decryptedMessages = await decryptConversationMessagesFn?.({
    messages,
    userId,
    options: {
      quiet: quietDecrypt,
      deferRoomDecrypt: conversation.type === 'room' && fastRoomOpen,
      allowRoomSenderKeyRecovery: !(conversation.type === 'room' && fastRoomOpen),
    },
  });

  return {
    messages: sortMessagesChronologicallyFn?.(decryptedMessages || []) || decryptedMessages || [],
    hasMore: Array.isArray(messages) ? messages.length >= limit : false,
    roomSenderKeySyncPromise,
  };
}
