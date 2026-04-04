export function buildRenderableMentionRanges(message) {
  const content = String(message?.content || '');
  if (!content || !Array.isArray(message?.mentions)) {
    return [];
  }

  const ranges = message.mentions
    .map((mention, index) => ({
      key: `${message?.id || 'message'}-${mention?.userId || 'user'}-${index}`,
      userId: mention?.userId || null,
      start: Number.isInteger(mention?.start) ? mention.start : -1,
      end: Number.isInteger(mention?.end) ? mention.end : -1,
      display: typeof mention?.display === 'string' ? mention.display : '',
    }))
    .filter((range) => range.start >= 0 && range.end > range.start && range.end <= content.length)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const normalized = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }
    normalized.push(range);
    cursor = range.end;
  }
  return normalized;
}

export function buildGuildChatTypingLabel(typingUsers = []) {
  if (!typingUsers.length) {
    return '';
  }
  const names = typingUsers.map((entry) => entry.username);
  return names.length === 1
    ? `${names[0]} is typing`
    : `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''} are typing`;
}
