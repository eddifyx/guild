import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import {
  guildChatMessageMentionsUser,
  mergeGuildChatMessage,
  updateGuildChatMessage,
} from './guildChatState.mjs';

export const GUILDCHAT_REALTIME_EVENT_NAMES = Object.freeze({
  message: 'guildchat:message',
  mention: 'guildchat:mention',
  messageEdited: 'guildchat:message:edited',
  typingStart: 'guildchat:typing:start',
  typingStop: 'guildchat:typing:stop',
  motdUpdated: 'guild:motd_updated',
});

export function createGuildChatRealtimeHandlers({
  currentGuild,
  currentUserId,
  setMessages,
  setTypingUsers,
  setMotdText,
  clearTypingTimeout,
  typingTimeouts,
  handleMentionNotification,
  typingTtlMs = 3500,
  setTimeoutFn = (fn, ms) => window.setTimeout(fn, ms),
} = {}) {
  return {
    onGuildChatMessage(message) {
      if (message?.guildId !== currentGuild) return;
      setMessages((prev) => mergeGuildChatMessage(prev, message));

      if (!guildChatMessageMentionsUser(message, currentUserId) || message?.senderId === currentUserId) {
        return;
      }
      recordLaneDiagnostic('messaging', 'guildchat_message_with_mention', {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        senderId: message?.senderId || null,
      });
      handleMentionNotification(message, 'guildchat:message');
    },

    onGuildChatMention({ message } = {}) {
      if (!message?.guildId || message?.senderId === currentUserId) {
        return;
      }
      recordLaneDiagnostic('messaging', 'guildchat_mention_socket_received', {
        guildId: message?.guildId || null,
        messageId: message?.id || null,
        senderId: message?.senderId || null,
      });
      handleMentionNotification(message, 'guildchat:mention');
    },

    onGuildChatMessageEdited({ guildId, messageId, content, mentions, editedAt }) {
      if (guildId !== currentGuild || !messageId) return;
      setMessages((prev) => updateGuildChatMessage(prev, messageId, (message) => ({
        ...message,
        content,
        mentions: Array.isArray(mentions) ? mentions : [],
        editedAt: editedAt || message.editedAt || null,
      })));
    },

    onTypingStart({ guildId, userId, username }) {
      if (guildId !== currentGuild || userId === currentUserId) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: username || 'Someone' }));
      clearTypingTimeout(userId);
      const timeoutId = setTimeoutFn(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        typingTimeouts.delete(userId);
      }, typingTtlMs);
      typingTimeouts.set(userId, timeoutId);
    },

    onTypingStop({ guildId, userId }) {
      if (guildId !== currentGuild) return;
      clearTypingTimeout(userId);
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    },

    onMotdUpdated({ guildId, motd }) {
      if (guildId !== currentGuild) return;
      setMotdText(motd || '');
    },
  };
}

export function registerGuildChatRealtimeSubscriptions(socket, handlers = {}) {
  if (!socket?.on || !socket?.off) {
    return () => {};
  }

  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.message, handlers.onGuildChatMessage);
  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.mention, handlers.onGuildChatMention);
  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.messageEdited, handlers.onGuildChatMessageEdited);
  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.typingStart, handlers.onTypingStart);
  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.typingStop, handlers.onTypingStop);
  socket.on(GUILDCHAT_REALTIME_EVENT_NAMES.motdUpdated, handlers.onMotdUpdated);

  return () => {
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.message, handlers.onGuildChatMessage);
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.mention, handlers.onGuildChatMention);
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.messageEdited, handlers.onGuildChatMessageEdited);
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.typingStart, handlers.onTypingStart);
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.typingStop, handlers.onTypingStop);
    socket.off(GUILDCHAT_REALTIME_EVENT_NAMES.motdUpdated, handlers.onMotdUpdated);
  };
}
