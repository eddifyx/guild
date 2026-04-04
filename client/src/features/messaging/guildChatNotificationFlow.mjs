import {
  buildGuildChatMentionNotificationDescriptor,
  evaluateGuildChatMentionNotification,
} from './notificationPolicyCore.mjs';
import { guildChatMessageMentionsUser } from './guildChatState.mjs';
import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import { isAppWindowForegrounded } from '../../utils/systemNotifications.js';

export function clearGuildChatUnreadMentions(unreadMentionIds) {
  unreadMentionIds?.clear?.();
  return 0;
}

export function markGuildChatUnreadMention(unreadMentionIds, message) {
  const messageId = typeof message?.id === 'string' ? message.id : '';
  if (!messageId || !unreadMentionIds?.has || !unreadMentionIds?.add) {
    return unreadMentionIds?.size || 0;
  }
  if (unreadMentionIds.has(messageId)) {
    return unreadMentionIds.size;
  }

  unreadMentionIds.add(messageId);
  return unreadMentionIds.size;
}

export function buildGuildChatMotdEntry({ motdText, sessionStartedAt, currentGuild } = {}) {
  const normalizedMotd = String(motdText || '').trim();
  if (!normalizedMotd || !sessionStartedAt || !currentGuild) return null;
  return {
    id: `motd-${currentGuild}-${sessionStartedAt}`,
    type: 'motd',
    senderName: '/guildchat',
    content: normalizedMotd,
    createdAt: new Date(sessionStartedAt).toISOString(),
  };
}

export function createGuildChatMentionNotificationHandler({
  currentGuild,
  currentUserId,
  isGuildChatVisible = () => false,
  shouldNotifyMention = () => true,
  markUnreadMention = () => {},
  mentionsUser = guildChatMessageMentionsUser,
  getNotificationContext = ({
    activeConversation = null,
    storage = null,
  } = {}) => ({
    activeConversation,
    storage,
    currentGuild,
    guildChatVisible: isGuildChatVisible(),
    appForegrounded: isAppWindowForegrounded(),
  }),
  evaluateNotification = evaluateGuildChatMentionNotification,
  buildDescriptor = buildGuildChatMentionNotificationDescriptor,
  presentNotification = () => false,
  diagnosticFn = recordLaneDiagnostic,
} = {}) {
  return function handleGuildChatMentionNotification(message, source) {
    if (!message?.guildId || message?.senderId === currentUserId) {
      return false;
    }

    if (!mentionsUser(message, currentUserId)) {
      diagnosticFn('messaging', 'guildchat_mention_suppressed', {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        reason: 'missing-self-mention',
      });
      return false;
    }

    if (!shouldNotifyMention(message)) {
      diagnosticFn('messaging', 'guildchat_mention_suppressed', {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        reason: 'duplicate-window',
      });
      return false;
    }

    const notificationContext = getNotificationContext();
    const decision = evaluateNotification({
      ...notificationContext,
      messageGuildId: message.guildId,
    });
    if (!decision.shouldNotify) {
      diagnosticFn('messaging', 'guildchat_mention_suppressed', {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        reason: decision.reason,
      });
      return false;
    }

    markUnreadMention(message);
    void presentNotification({
      descriptor: buildDescriptor({ message }),
      diagnosticEvent: 'guildchat_mention_notification_requested',
      diagnosticContext: {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        source,
      },
    });
    return true;
  };
}
