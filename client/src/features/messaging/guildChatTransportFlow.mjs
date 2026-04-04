import { extractGuildMentions } from './guildChatMentions.js';
import {
  buildGuildChatAttachmentRequestPayload,
  buildOptimisticGuildChatMessage,
  createLocalGuildChatId,
  markGuildChatMessageFailed,
  markGuildChatMessageSent,
  trimLiveGuildChatMessages,
} from './guildChatState.mjs';
import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';

export const GUILDCHAT_TRANSPORT_EVENT_NAMES = Object.freeze({
  join: 'guildchat:join',
  leave: 'guildchat:leave',
  message: 'guildchat:message',
  typingStart: 'guildchat:typing:start',
  typingStop: 'guildchat:typing:stop',
});

export const GUILDCHAT_SEND_TIMEOUT_MS = 10_000;

export function joinGuildChatSession({
  socket,
  connected,
  currentGuild,
  canListen,
  setLastError,
  diagnosticFn = recordLaneDiagnostic,
} = {}) {
  if (!socket?.emit || !connected || !currentGuild) {
    return () => {};
  }

  setLastError?.('');
  diagnosticFn('messaging', 'guildchat_join_requested', {
    guildId: currentGuild,
    localCanListen: canListen,
  });

  socket.emit(GUILDCHAT_TRANSPORT_EVENT_NAMES.join, { guildId: currentGuild }, (ack = {}) => {
    diagnosticFn('messaging', 'guildchat_join_ack', {
      guildId: currentGuild,
      ok: !!ack?.ok,
      code: ack?.code || null,
      error: ack?.error || null,
    });
    if (!ack?.ok) {
      setLastError?.(ack?.error || 'Unable to join /guildchat.');
    }
  });

  return () => {
    socket.emit(GUILDCHAT_TRANSPORT_EVENT_NAMES.leave, { guildId: currentGuild });
  };
}

export function emitGuildChatTypingState({
  socket,
  connected,
  currentGuild,
  typing,
} = {}) {
  if (!socket?.emit || !connected || !currentGuild) return false;
  socket.emit(
    typing ? GUILDCHAT_TRANSPORT_EVENT_NAMES.typingStart : GUILDCHAT_TRANSPORT_EVENT_NAMES.typingStop,
    { guildId: currentGuild }
  );
  return true;
}

export function createGuildChatSendAction({
  socket,
  connected,
  currentGuild,
  currentMembers = [],
  user,
  myMember,
  setLastError,
  setMessages,
  extractMentions = extractGuildMentions,
  createLocalId = createLocalGuildChatId,
  setTimeoutFn = (...args) => globalThis.window?.setTimeout?.(...args) ?? globalThis.setTimeout?.(...args),
  clearTimeoutFn = (...args) => globalThis.window?.clearTimeout?.(...args) ?? globalThis.clearTimeout?.(...args),
  ackTimeoutMs = GUILDCHAT_SEND_TIMEOUT_MS,
  diagnosticFn = recordLaneDiagnostic,
} = {}) {
  return async function sendGuildChatMessage(rawContent, attachments = null) {
    if (!currentGuild) {
      throw new Error('/guildchat is unavailable right now.');
    }
    if (!socket?.emit || !connected) {
      throw new Error('/guildchat is offline right now.');
    }

    const content = String(rawContent || '').trim();
    const safeAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    if (!content && safeAttachments.length === 0) return null;
    const mentions = extractMentions(content, currentMembers);

    setLastError?.('');
    const clientNonce = createLocalId();
    const optimisticMessage = buildOptimisticGuildChatMessage({
      guildId: currentGuild,
      content,
      user,
      myMember,
      mentions,
      attachments: safeAttachments,
      clientNonce,
      createLocalId,
    });

    setMessages?.((previousMessages) => trimLiveGuildChatMessages([
      ...previousMessages,
      optimisticMessage,
    ]));

    return new Promise((resolve, reject) => {
      let settled = false;
      const markFailed = (errorMessage) => {
        if (settled) return;
        settled = true;
        setLastError?.(errorMessage);
        setMessages?.((previousMessages) => markGuildChatMessageFailed(previousMessages, clientNonce));
        reject(new Error(errorMessage));
      };

      const timeoutId = setTimeoutFn(() => {
        markFailed('/guildchat send timed out. Please try again.');
      }, ackTimeoutMs);

      socket.emit(GUILDCHAT_TRANSPORT_EVENT_NAMES.message, {
        guildId: currentGuild,
        content,
        clientNonce,
        mentions,
        attachments: buildGuildChatAttachmentRequestPayload(safeAttachments),
      }, (ack = {}) => {
        if (settled) return;
        settled = true;
        clearTimeoutFn(timeoutId);

        if (!ack?.ok) {
          const errorMessage = ack?.error || 'Failed to send /guildchat message.';
          diagnosticFn('messaging', 'guildchat_send_ack', {
            guildId: currentGuild,
            ok: false,
            code: ack?.code || null,
            error: errorMessage,
          });
          setLastError?.(errorMessage);
          setMessages?.((previousMessages) => markGuildChatMessageFailed(previousMessages, clientNonce));
          reject(new Error(errorMessage));
          return;
        }

        diagnosticFn('messaging', 'guildchat_send_ack', {
          guildId: currentGuild,
          ok: true,
          messageId: ack.messageId || null,
        });
        setMessages?.((previousMessages) => markGuildChatMessageSent(previousMessages, clientNonce, ack.messageId));
        resolve(ack.messageId || clientNonce);
      });
    });
  };
}
