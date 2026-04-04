const { ERROR_CODES } = require('../../contracts/errorCodes');
const { hasGuildPermission } = require('../guild/capabilities');

const MAX_GUILDCHAT_MENTIONS = 25;
const MAX_GUILDCHAT_MENTION_TEXT_LENGTH = 160;
const GUILDCHAT_MENTION_DUPLICATE_SEPARATOR = '·';

function normalizeGuildChatContent(content) {
  return typeof content === 'string' ? content.trim() : '';
}

function normalizeGuildMentionUsername(username) {
  return String(username || '').trim();
}

function normalizeGuildMentionLookup(username) {
  return normalizeGuildMentionUsername(username).toLowerCase();
}

function buildGuildMentionSuffix(member) {
  return String(member?.npub || member?.id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(-4) || 'user';
}

function buildGuildMentionToken(username) {
  return normalizeGuildMentionUsername(username).replace(/\s+/g, GUILDCHAT_MENTION_DUPLICATE_SEPARATOR);
}

function buildGuildMentionDirectory(members = []) {
  const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  const duplicateCountByUsername = new Map();

  for (const member of safeMembers) {
    const lookup = normalizeGuildMentionLookup(member.username);
    if (!lookup) continue;
    duplicateCountByUsername.set(lookup, (duplicateCountByUsername.get(lookup) || 0) + 1);
  }

  const entries = safeMembers.map((member) => {
    const username = normalizeGuildMentionUsername(member.username) || 'Unknown';
    const duplicate = (duplicateCountByUsername.get(normalizeGuildMentionLookup(username)) || 0) > 1;
    const suffix = duplicate ? buildGuildMentionSuffix(member) : '';
    const baseToken = buildGuildMentionToken(username);
    const mentionToken = duplicate
      ? `@${baseToken}${GUILDCHAT_MENTION_DUPLICATE_SEPARATOR}${suffix}`
      : `@${baseToken}`;

    return {
      userId: member.id,
      mentionToken,
      displayLabel: duplicate ? `@${username} ${GUILDCHAT_MENTION_DUPLICATE_SEPARATOR} ${suffix}` : `@${username}`,
    };
  });

  return new Map(entries.map((entry) => [entry.mentionToken.toLowerCase(), entry]));
}

function extractGuildChatMentionsFromContent(content, members = []) {
  const normalizedContent = String(content || '');
  if (!normalizedContent.includes('@')) return [];

  const mentionDirectory = buildGuildMentionDirectory(members);
  if (mentionDirectory.size === 0) return [];

  const mentions = [];
  const mentionPattern = /(^|\s)(@([^\s@]+))/g;
  const seen = new Set();
  let match = null;

  while ((match = mentionPattern.exec(normalizedContent)) !== null) {
    const matchedToken = match[2];
    const matchedEntry = mentionDirectory.get(matchedToken.toLowerCase());
    if (!matchedEntry || seen.has(matchedEntry.userId)) continue;

    const start = match.index + match[1].length;
    const end = start + matchedToken.length;
    mentions.push({
      userId: matchedEntry.userId,
      label: matchedToken,
      display: matchedEntry.displayLabel,
      start,
      end,
    });
    seen.add(matchedEntry.userId);
  }

  return mentions;
}

function mergeGuildChatMentions(primary = [], fallback = []) {
  const merged = [];
  const seen = new Set();

  for (const mention of [...primary, ...fallback]) {
    const targetUserId = typeof mention?.userId === 'string' ? mention.userId.trim() : '';
    if (!targetUserId || seen.has(targetUserId)) continue;
    merged.push(mention);
    seen.add(targetUserId);
  }

  return merged;
}

function sanitizeGuildChatMentions(mentions, members = []) {
  if (!mentions) return [];
  if (!Array.isArray(mentions)) return null;

  const memberIds = new Set((Array.isArray(members) ? members : []).map((member) => member?.id).filter(Boolean));
  const normalized = [];
  const seen = new Set();

  for (const mention of mentions.slice(0, MAX_GUILDCHAT_MENTIONS)) {
    const targetUserId = typeof mention?.userId === 'string' ? mention.userId.trim() : '';
    if (!targetUserId || seen.has(targetUserId)) continue;
    if (!memberIds.has(targetUserId)) continue;

    const start = Number.isInteger(mention?.start) && mention.start >= 0 ? mention.start : null;
    const end = Number.isInteger(mention?.end) && start !== null && mention.end >= start ? mention.end : null;
    const label = typeof mention?.label === 'string'
      ? mention.label.trim().slice(0, MAX_GUILDCHAT_MENTION_TEXT_LENGTH)
      : '';
    const display = typeof mention?.display === 'string'
      ? mention.display.trim().slice(0, MAX_GUILDCHAT_MENTION_TEXT_LENGTH)
      : '';

    const nextMention = { userId: targetUserId };
    if (label) nextMention.label = label;
    if (display) nextMention.display = display;
    if (start !== null) nextMention.start = start;
    if (end !== null) nextMention.end = end;

    normalized.push(nextMention);
    seen.add(targetUserId);
  }

  return normalized;
}

function resolveEffectiveGuildChatMentions({ content, requestedMentions, members = [] } = {}) {
  const normalizedContent = normalizeGuildChatContent(content);
  const safeRequestedMentions = sanitizeGuildChatMentions(requestedMentions, members);
  if (requestedMentions && safeRequestedMentions === null) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_GUILDCHAT_MENTION_PAYLOAD,
      error: 'Invalid mention payload',
    };
  }

  const extractedMentions = extractGuildChatMentionsFromContent(normalizedContent, members);
  const extractedMentionUserIds = new Set(extractedMentions.map((mention) => mention.userId));
  const effectiveMentions = mergeGuildChatMentions(
    extractedMentions,
    safeRequestedMentions.filter((mention) => extractedMentionUserIds.has(mention.userId))
  );

  return {
    ok: true,
    normalizedContent,
    extractedMentions,
    requestedMentions: safeRequestedMentions,
    effectiveMentions,
    requestedMentionCount: safeRequestedMentions.length,
    extractedMentionCount: extractedMentions.length,
    effectiveMentionCount: effectiveMentions.length,
    wasPruned: safeRequestedMentions.length > 0 && safeRequestedMentions.length !== effectiveMentions.length,
  };
}

function buildGuildChatMessage({
  messageId,
  guildId,
  content,
  sender,
  senderId,
  clientNonce = null,
  mentions = [],
  attachments = [],
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    id: messageId,
    guildId,
    content: normalizeGuildChatContent(content),
    senderId,
    senderName: sender?.username || 'Unknown',
    senderColor: sender?.avatar_color || null,
    senderPicture: sender?.profile_picture || null,
    senderNpub: sender?.npub || null,
    createdAt,
    clientNonce,
    mentions: Array.isArray(mentions) ? mentions : [],
    attachments: (Array.isArray(attachments) ? attachments : []).map(({ _storedName, ...attachment }) => attachment),
  };
}

function listGuildChatMentionRecipients(mentions = [], senderUserId = null) {
  return (Array.isArray(mentions) ? mentions : [])
    .map((mention) => mention?.userId || null)
    .filter((targetUserId) => targetUserId && targetUserId !== senderUserId);
}

function getGuildChatPermissionFailure(member, permissionKey) {
  if (!member) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_GUILD_MEMBER,
      error: 'Not a member of this guild',
    };
  }

  if (hasGuildPermission(member, permissionKey)) {
    return { ok: true };
  }

  if (permissionKey === 'guild_chat_listen') {
    return {
      ok: false,
      code: ERROR_CODES.GUILDCHAT_LISTEN_FORBIDDEN,
      error: 'You do not have permission to view /guildchat.',
    };
  }

  return {
    ok: false,
    code: ERROR_CODES.GUILDCHAT_SPEAK_FORBIDDEN,
    error: 'You do not have permission to post in /guildchat.',
  };
}

module.exports = {
  ERROR_CODES,
  buildGuildChatMessage,
  buildGuildMentionDirectory,
  extractGuildChatMentionsFromContent,
  getGuildChatPermissionFailure,
  listGuildChatMentionRecipients,
  mergeGuildChatMentions,
  normalizeGuildChatContent,
  resolveEffectiveGuildChatMentions,
  sanitizeGuildChatMentions,
};
