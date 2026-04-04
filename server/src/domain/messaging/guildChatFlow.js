const { ERROR_CODES } = require('../../contracts/errorCodes');

function createGuildChatFlow({
  io,
  socket,
  userId,
  username,
  joinedGuildChats,
  guildChatRoom,
  cancelGuildChatCleanup,
  scheduleGuildChatCleanup,
  rejectInvalidGuildChatPayload,
  validateGuildChatGuildPayload,
  validateGuildChatMessagePayload,
  getGuildMemberWithPerms,
  ensureGuildChatPermission,
  checkMessageRate,
  checkTypingRate,
  maxAttachments,
  maxContentLength,
  sanitizeGuildChatAttachmentRefs,
  getGuildMembers,
  resolveEffectiveGuildChatMentions,
  getUserById,
  claimGuildChatAttachments,
  buildGuildChatMessage,
  trackGuildChatAttachments,
  listGuildChatMentionRecipients,
  runtimeMetrics,
  createMessageId,
} = {}) {
  return {
    handleJoin({ guildId }, ack) {
      const guildPayload = validateGuildChatGuildPayload({ guildId });
      if (!guildPayload.ok) return rejectInvalidGuildChatPayload('guildchat:join', guildPayload, ack);
      const safeGuildId = guildPayload.value.guildId;
      const member = getGuildMemberWithPerms(safeGuildId);
      if (!member) return ack({ ok: false, error: 'Not a member of this guild' });
      if (!ensureGuildChatPermission(member, 'guild_chat_listen', ack, 'You do not have permission to view /guildchat.')) {
        return;
      }

      runtimeMetrics.recordChatEvent('guildchat:join', {
        guildId: safeGuildId,
        userId,
        rankOrder: member.rankOrder ?? member.rank_order ?? null,
      });
      cancelGuildChatCleanup(safeGuildId);
      socket.join(guildChatRoom(safeGuildId));
      joinedGuildChats.add(safeGuildId);
      ack({ ok: true });
    },

    handleLeave({ guildId }, ack) {
      const guildPayload = validateGuildChatGuildPayload({ guildId });
      if (!guildPayload.ok) return rejectInvalidGuildChatPayload('guildchat:leave', guildPayload, ack);
      const safeGuildId = guildPayload.value.guildId;
      socket.leave(guildChatRoom(safeGuildId));
      joinedGuildChats.delete(safeGuildId);
      scheduleGuildChatCleanup(io, safeGuildId);
      ack({ ok: true });
    },

    handleMessage({ guildId, content, attachments, clientNonce, mentions }, ack) {
      const messagePayload = validateGuildChatMessagePayload({
        guildId,
        content,
        attachments,
        clientNonce,
        mentions,
      });
      if (!messagePayload.ok) return rejectInvalidGuildChatPayload('guildchat:message', messagePayload, ack);
      const safeGuildId = messagePayload.value.guildId;
      if (!checkMessageRate()) {
        return ack({ ok: false, error: 'Rate limit exceeded' });
      }

      const member = getGuildMemberWithPerms(safeGuildId);
      if (!member) return ack({ ok: false, error: 'Not a member of this guild' });
      if (!ensureGuildChatPermission(member, 'guild_chat_listen', ack, 'You do not have permission to view /guildchat.')) {
        return;
      }
      if (!ensureGuildChatPermission(member, 'guild_chat_speak', ack, 'You do not have permission to post in /guildchat.')) {
        return;
      }

      const safeAttachments = sanitizeGuildChatAttachmentRefs(messagePayload.value.attachments);
      if (messagePayload.value.attachments && safeAttachments === null) {
        return ack({ ok: false, error: 'Invalid attachment payload' });
      }
      if (
        Array.isArray(messagePayload.value.attachments)
        && safeAttachments.length !== messagePayload.value.attachments.slice(0, maxAttachments).length
      ) {
        return ack({ ok: false, error: 'Invalid attachment reference' });
      }

      const guildMembers = getGuildMembers.all(safeGuildId);
      const mentionResolution = resolveEffectiveGuildChatMentions({
        content: messagePayload.value.content,
        requestedMentions: messagePayload.value.mentions,
        members: guildMembers,
      });
      if (!mentionResolution.ok) {
        runtimeMetrics.recordChatEvent('guildchat:invalid_mentions', { guildId: safeGuildId, userId });
        return ack({
          ok: false,
          error: mentionResolution.error || 'Invalid mention payload',
          code: mentionResolution.code || ERROR_CODES.INVALID_GUILDCHAT_MENTION_PAYLOAD,
        });
      }

      const normalizedContent = mentionResolution.normalizedContent;
      if (!normalizedContent && safeAttachments.length === 0) {
        return ack({ ok: false, error: 'Message content or image required' });
      }
      if (normalizedContent.length > maxContentLength) {
        return ack({ ok: false, error: 'Message is too large' });
      }

      if (mentionResolution.wasPruned) {
        runtimeMetrics.recordChatEvent('guildchat:mention_payload_pruned', {
          guildId: safeGuildId,
          userId,
          extractedMentionCount: mentionResolution.extractedMentionCount,
          requestedMentionCount: mentionResolution.requestedMentionCount,
          effectiveMentionCount: mentionResolution.effectiveMentionCount,
        });
      }

      const sender = getUserById.get(userId);
      if (!sender) return ack({ ok: false, error: 'Sender not found' });

      const safeClientNonce = messagePayload.value.clientNonce || null;

      let savedAttachments = [];
      const messageId = createMessageId();
      try {
        savedAttachments = claimGuildChatAttachments(messageId, safeGuildId, safeAttachments);
      } catch (err) {
        return ack({ ok: false, error: err.message || 'Failed to attach uploaded image' });
      }

      const message = buildGuildChatMessage({
        messageId,
        guildId: safeGuildId,
        content: normalizedContent,
        sender,
        senderId: userId,
        clientNonce: safeClientNonce,
        mentions: mentionResolution.effectiveMentions,
        attachments: savedAttachments,
      });

      trackGuildChatAttachments(safeGuildId, message.id, savedAttachments);
      io.to(guildChatRoom(safeGuildId)).emit('guildchat:message', message);
      for (const targetUserId of listGuildChatMentionRecipients(message.mentions, userId)) {
        runtimeMetrics.recordChatEvent('guildchat:mention_emitted', {
          guildId: safeGuildId,
          messageId: message.id,
          fromUserId: userId,
          targetUserId,
        });
        io.to(`user:${targetUserId}`).emit('guildchat:mention', { message });
      }
      runtimeMetrics.recordChatMessage('guildchat', {
        guildId: safeGuildId,
        encrypted: false,
        attachmentCount: savedAttachments.length,
      });
      ack({ ok: true, messageId: message.id, clientNonce: safeClientNonce });
    },

    handleTypingStart({ guildId }, ack) {
      const guildPayload = validateGuildChatGuildPayload({ guildId });
      if (!guildPayload.ok) return rejectInvalidGuildChatPayload('guildchat:typing:start', guildPayload, ack);
      const safeGuildId = guildPayload.value.guildId;
      if (!checkTypingRate()) {
        return ack({ ok: false, error: 'Rate limit exceeded' });
      }
      const member = getGuildMemberWithPerms(safeGuildId);
      if (!member) return ack({ ok: false, error: 'Not a member of this guild' });
      if (!ensureGuildChatPermission(member, 'guild_chat_listen', ack, 'You do not have permission to view /guildchat.')) {
        return;
      }
      if (!ensureGuildChatPermission(member, 'guild_chat_speak', ack, 'You do not have permission to post in /guildchat.')) {
        return;
      }
      socket.to(guildChatRoom(safeGuildId)).emit('guildchat:typing:start', { guildId: safeGuildId, userId, username });
      ack({ ok: true });
    },

    handleTypingStop({ guildId }, ack) {
      const guildPayload = validateGuildChatGuildPayload({ guildId });
      if (!guildPayload.ok) return rejectInvalidGuildChatPayload('guildchat:typing:stop', guildPayload, ack);
      const safeGuildId = guildPayload.value.guildId;
      if (!checkTypingRate()) {
        return ack({ ok: false, error: 'Rate limit exceeded' });
      }
      const member = getGuildMemberWithPerms(safeGuildId);
      if (!member) return ack({ ok: false, error: 'Not a member of this guild' });
      if (!ensureGuildChatPermission(member, 'guild_chat_listen', ack, 'You do not have permission to view /guildchat.')) {
        return;
      }
      if (!ensureGuildChatPermission(member, 'guild_chat_speak', ack, 'You do not have permission to post in /guildchat.')) {
        return;
      }
      socket.to(guildChatRoom(safeGuildId)).emit('guildchat:typing:stop', { guildId: safeGuildId, userId, username });
      ack({ ok: true });
    },

    handleDisconnect() {
      for (const guildId of joinedGuildChats) {
        scheduleGuildChatCleanup(io, guildId);
      }
      joinedGuildChats.clear();
    },
  };
}

module.exports = {
  createGuildChatFlow,
};
