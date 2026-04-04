const GUILDCHAT_MENTION_DUPLICATE_SEPARATOR = '·';
const MAX_GUILDCHAT_MENTIONS = 25;
const MAX_GUILDCHAT_MENTION_SUGGESTIONS = 6;

function normalizeMentionUsername(username) {
  return String(username || '').trim();
}

function normalizeMentionLookup(username) {
  return normalizeMentionUsername(username).toLowerCase();
}

function buildMentionToken(username) {
  return normalizeMentionUsername(username).replace(/\s+/g, GUILDCHAT_MENTION_DUPLICATE_SEPARATOR);
}

function normalizeMentionSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[.\s·_-]+/g, '');
}

function buildMentionSuffix(member) {
  return String(member?.npub || member?.id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(-4) || 'user';
}

export function buildGuildMentionDirectory(members = []) {
  const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  const duplicateCountByUsername = new Map();

  for (const member of safeMembers) {
    const lookup = normalizeMentionLookup(member.username);
    if (!lookup) continue;
    duplicateCountByUsername.set(lookup, (duplicateCountByUsername.get(lookup) || 0) + 1);
  }

  const entries = safeMembers.map((member) => {
    const username = normalizeMentionUsername(member.username) || 'Unknown';
    const duplicate = (duplicateCountByUsername.get(normalizeMentionLookup(username)) || 0) > 1;
    const suffix = duplicate ? buildMentionSuffix(member) : '';
    const baseToken = buildMentionToken(username);
    const mentionToken = duplicate
      ? `@${baseToken}${GUILDCHAT_MENTION_DUPLICATE_SEPARATOR}${suffix}`
      : `@${baseToken}`;

    return {
      userId: member.id,
      username,
      duplicate,
      suffix,
      mentionToken,
      displayLabel: duplicate ? `@${username} ${GUILDCHAT_MENTION_DUPLICATE_SEPARATOR} ${suffix}` : `@${username}`,
      lookupToken: mentionToken.toLowerCase(),
    };
  });

  return {
    entries,
    byLookupToken: new Map(entries.map((entry) => [entry.lookupToken, entry])),
  };
}

export function extractGuildMentions(content, members = []) {
  const normalizedContent = String(content || '');
  if (!normalizedContent.includes('@')) return [];

  const { byLookupToken } = buildGuildMentionDirectory(members);
  const mentions = [];
  const seenUserIds = new Set();
  const mentionPattern = /(^|\s)(@([^\s@]+))/g;
  let match = null;

  while ((match = mentionPattern.exec(normalizedContent)) !== null) {
    const matchedToken = match[2];
    const matchedEntry = byLookupToken.get(matchedToken.toLowerCase());
    if (!matchedEntry || seenUserIds.has(matchedEntry.userId)) continue;

    const start = match.index + match[1].length;
    const end = start + matchedToken.length;
    mentions.push({
      userId: matchedEntry.userId,
      label: matchedToken,
      display: matchedEntry.displayLabel,
      start,
      end,
    });
    seenUserIds.add(matchedEntry.userId);
    if (mentions.length >= MAX_GUILDCHAT_MENTIONS) {
      break;
    }
  }

  return mentions;
}

export function getGuildMentionSearchState(content, caretPosition = null) {
  const normalizedContent = String(content || '');
  const safeCaretPosition = Number.isInteger(caretPosition)
    ? Math.max(0, Math.min(caretPosition, normalizedContent.length))
    : normalizedContent.length;
  const beforeCaret = normalizedContent.slice(0, safeCaretPosition);
  const match = /(^|\s)@([^\s@]*)$/.exec(beforeCaret);
  if (!match) return null;

  return {
    query: match[2] || '',
    replaceStart: safeCaretPosition - ((match[2] || '').length + 1),
    replaceEnd: safeCaretPosition,
  };
}

export function findGuildMentionSuggestions(
  content,
  caretPosition,
  members = [],
  { excludeUserId = null, limit = MAX_GUILDCHAT_MENTION_SUGGESTIONS } = {},
) {
  const state = getGuildMentionSearchState(content, caretPosition);
  if (!state) return { state: null, suggestions: [] };

  const { entries } = buildGuildMentionDirectory(members);
  const normalizedQuery = normalizeMentionSearch(state.query);

  const suggestions = entries
    .filter((entry) => entry.userId && entry.userId !== excludeUserId)
    .map((entry) => {
      const searchableValues = [
        entry.username,
        entry.mentionToken,
        entry.displayLabel,
      ].map(normalizeMentionSearch);
      const startsWithMatch = normalizedQuery.length === 0
        || searchableValues.some((value) => value.startsWith(normalizedQuery));
      const includesMatch = startsWithMatch
        || searchableValues.some((value) => value.includes(normalizedQuery));

      return {
        ...entry,
        startsWithMatch,
        includesMatch,
      };
    })
    .filter((entry) => normalizedQuery.length === 0 || entry.includesMatch)
    .sort((left, right) => {
      if (left.startsWithMatch !== right.startsWithMatch) {
        return left.startsWithMatch ? -1 : 1;
      }
      return left.username.localeCompare(right.username);
    })
    .slice(0, limit);

  return { state, suggestions };
}

export {
  GUILDCHAT_MENTION_DUPLICATE_SEPARATOR,
  MAX_GUILDCHAT_MENTIONS,
  MAX_GUILDCHAT_MENTION_SUGGESTIONS,
};
