export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export function getMessageTimestampValue(message) {
  const raw = message?.created_at ?? message?.createdAt ?? message?.timestamp ?? null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
      ? normalized
      : `${normalized}Z`;
    const parsed = Date.parse(zoned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export function shouldGroupWithPreviousMessage(previousMessage, currentMessage) {
  if (!previousMessage || !currentMessage) return false;
  if (!previousMessage.sender_id || !currentMessage.sender_id) return false;
  if (previousMessage.sender_id !== currentMessage.sender_id) return false;

  const previousName = (previousMessage.sender_name || '').trim();
  const currentName = (currentMessage.sender_name || '').trim();
  if (previousName && currentName && previousName !== currentName) return false;

  const previousTimestamp = getMessageTimestampValue(previousMessage);
  const currentTimestamp = getMessageTimestampValue(currentMessage);
  if (previousTimestamp == null || currentTimestamp == null) return false;

  return currentTimestamp >= previousTimestamp
    && (currentTimestamp - previousTimestamp) <= MESSAGE_GROUP_WINDOW_MS;
}

export function isConversationDmSupported(conversation, currentGuildData, guildLoading) {
  if (conversation?.type !== 'dm') return true;
  if (guildLoading) return true;
  return (currentGuildData?.members || []).some((member) => member.id === conversation.id);
}

export function getEffectiveConversation(conversation, dmSupported) {
  if (conversation?.type === 'dm' && !dmSupported) {
    return { ...conversation, dmUnsupported: true };
  }
  return conversation;
}
