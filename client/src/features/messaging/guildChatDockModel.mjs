import { getMessageTimestampValue } from './chatViewModel.mjs';

export const GUILD_CHAT_TIMESTAMP_SEPARATOR_GAP_MS = 60 * 60 * 1000;

export function buildGuildChatComposerAccess({
  connected = false,
  canListen = true,
  canSpeak = true,
} = {}) {
  const composerDisabledReason = !canListen
    ? 'You do not have permission to view /guildchat.'
    : !canSpeak
      ? 'You can read /guildchat, but your role cannot post here.'
      : !connected
        ? '/guildchat reconnecting...'
        : '';

  return {
    composerDisabledReason,
    canCompose: connected && canListen && canSpeak,
  };
}

export function buildGuildChatLiveEntries({
  motdEntry = null,
  messages = [],
} = {}) {
  const liveEntries = [];

  if (motdEntry) {
    liveEntries.push(motdEntry);
  }

  let previousMessage = null;
  for (const message of messages || []) {
    if (shouldInsertGuildChatTimestampSeparator(previousMessage, message)) {
      liveEntries.push(buildGuildChatTimestampSeparatorEntry(message, previousMessage));
    }
    liveEntries.push(message);
    previousMessage = message;
  }

  return liveEntries;
}

export function shouldContinueGuildChatMessage(previousMessage, message) {
  return !!previousMessage
    && message?.type !== 'motd'
    && message?.type !== 'timestamp-separator'
    && previousMessage?.type !== 'motd'
    && previousMessage?.type !== 'timestamp-separator'
    && previousMessage?.senderName === message?.senderName;
}

export function shouldInsertGuildChatTimestampSeparator(previousMessage, message) {
  if (!previousMessage || !message) return false;
  if (previousMessage?.type === 'motd' || message?.type === 'motd') return false;

  const previousTimestamp = getMessageTimestampValue(previousMessage);
  const currentTimestamp = getMessageTimestampValue(message);
  if (previousTimestamp == null || currentTimestamp == null) return false;
  if (currentTimestamp < previousTimestamp) return false;

  return (currentTimestamp - previousTimestamp) > GUILD_CHAT_TIMESTAMP_SEPARATOR_GAP_MS;
}

export function buildGuildChatTimestampSeparatorEntry(message, previousMessage = null) {
  return {
    id: `guildchat-separator-${message?.id || getMessageTimestampValue(message) || 'unknown'}`,
    type: 'timestamp-separator',
    createdAt: message?.createdAt || message?.created_at || message?.timestamp || null,
    previousCreatedAt: previousMessage?.createdAt || previousMessage?.created_at || previousMessage?.timestamp || null,
  };
}

export function normalizeGuildChatMentionSelectionIndex({
  mentionSuggestions = [],
  selectedIndex = 0,
} = {}) {
  if (!Array.isArray(mentionSuggestions) || mentionSuggestions.length === 0) {
    return 0;
  }
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= mentionSuggestions.length) {
    return 0;
  }
  return selectedIndex;
}

export function buildGuildChatSendState({
  draft = '',
  pendingFiles = [],
  canCompose = false,
  sending = false,
} = {}) {
  const hasContent = String(draft || '').trim().length > 0 || (Array.isArray(pendingFiles) && pendingFiles.length > 0);
  return {
    hasContent,
    canSend: canCompose && hasContent && !sending,
  };
}

export function buildGuildChatPendingUploadEntries({
  pendingFiles = [],
} = {}) {
  return (pendingFiles || []).map((file, index) => ({
    key: file?.fileId || file?.id || index,
    index,
    name: file?._originalName || file?.fileName || 'Attachment',
    previewUrl: file?._previewUrl || null,
    isImage: String(file?._originalType || file?.fileType || '').startsWith('image/'),
  }));
}

export function buildGuildChatMentionSuggestionEntries({
  mentionSuggestions = [],
  selectedMentionSuggestionIndex = 0,
  members = [],
} = {}) {
  const membersById = new Map((members || []).map((member) => [
    member?.id || member?.userId,
    member,
  ]));

  return (mentionSuggestions || []).map((suggestion, index) => {
    const member = membersById.get(suggestion.userId) || null;

    return {
      ...suggestion,
      selected: index === selectedMentionSuggestionIndex,
      avatarColor: member?.avatarColor || member?.avatar_color || '#40FF40',
      profilePicture: member?.profilePicture || member?.profile_picture || null,
    };
  });
}
