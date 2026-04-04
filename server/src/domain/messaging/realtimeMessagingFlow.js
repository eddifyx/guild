function createRealtimeMessagingFlow({
  io,
  socket,
  userId,
  username,
  checkMessageRate,
  checkTypingRate,
  maxContentLength,
  maxAttachments,
  isRoomMember,
  getUserById,
  ensureDirectMessagesAvailable,
  ensureBoardsAvailable = () => true,
  sanitizeAttachmentRefs,
  persistRoomMessage,
  persistDMMessage,
  upsertSenderKeyDistribution,
  buildRoomMessage,
  buildDirectMessage,
  buildDirectSenderKeyPayload,
  validateDirectSenderKeyMetadata,
  runtimeMetrics,
  uuidGenerator,
  getStoredMessageById,
} = {}) {
  function buildTimestamp(messageId) {
    const stored = getStoredMessageById?.(messageId);
    return stored ? stored.created_at : new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  function normalizeClientNonce(clientNonce) {
    return typeof clientNonce === 'string' && clientNonce.length <= 128
      ? clientNonce
      : null;
  }

  function normalizeAndValidateAttachments(attachments, ack) {
    const safeAttachments = sanitizeAttachmentRefs(attachments);
    if (attachments && safeAttachments === null) {
      ack({ ok: false, error: 'Invalid attachment payload' });
      return null;
    }
    if (Array.isArray(attachments) && safeAttachments.length !== attachments.slice(0, maxAttachments).length) {
      ack({ ok: false, error: 'Invalid attachment reference' });
      return null;
    }
    return safeAttachments;
  }

  return {
    handleRoomJoin({ roomId }, ack) {
      if (!ensureBoardsAvailable(ack)) return;
      if (!roomId) return ack({ ok: false, error: 'Room ID required' });
      const member = isRoomMember.get(roomId, userId);
      if (!member) return ack({ ok: false, error: 'Not a member of this room' });
      socket.join(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('room:user_joined', { roomId, userId, username });
      ack({ ok: true });
    },

    handleRoomLeave({ roomId }, ack) {
      if (!ensureBoardsAvailable(ack)) return;
      if (!roomId) return ack({ ok: false, error: 'Room ID required' });
      const member = isRoomMember.get(roomId, userId);
      socket.leave(`room:${roomId}`);
      if (member) {
        io.to(`room:${roomId}`).emit('room:user_left', { roomId, userId, username });
      }
      ack({ ok: true });
    },

    handleRoomMessage({ roomId, content, attachments, encrypted, clientNonce }, ack) {
      if (!ensureBoardsAvailable(ack)) return;
      if (!roomId) return ack({ ok: false, error: 'Room ID required' });
      if (!checkMessageRate()) return ack({ ok: false, error: 'Rate limit exceeded' });
      if (content && typeof content === 'string' && content.length > maxContentLength) {
        return ack({ ok: false, error: 'Message is too large' });
      }
      const member = isRoomMember.get(roomId, userId);
      if (!member) return ack({ ok: false, error: 'Not a member of this room' });
      if (encrypted && (!content || typeof content !== 'string')) {
        return ack({ ok: false, error: 'Encrypted payload required' });
      }

      const safeAttachments = normalizeAndValidateAttachments(attachments, ack);
      if (safeAttachments === null) return;

      const safeClientNonce = normalizeClientNonce(clientNonce);
      const msgId = uuidGenerator();
      let savedAttachments;
      try {
        savedAttachments = persistRoomMessage({
          msgId,
          roomId,
          content,
          encrypted,
          attachmentRefs: safeAttachments,
        });
      } catch (err) {
        return ack({ ok: false, error: err.message || 'Failed to attach uploaded file' });
      }

      const user = getUserById.get(userId);
      if (!user) return ack({ ok: false, error: 'Sender not found' });

      const message = buildRoomMessage({
        messageId: msgId,
        roomId,
        content,
        sender: user,
        senderId: userId,
        attachments: savedAttachments,
        encrypted,
        clientNonce: safeClientNonce,
        createdAt: buildTimestamp(msgId),
      });

      io.to(`room:${roomId}`).emit('room:message', message);
      runtimeMetrics.recordChatMessage('room', {
        roomId,
        encrypted: !!encrypted,
        attachmentCount: savedAttachments.length,
      });
      ack({ ok: true, messageId: msgId, clientNonce: safeClientNonce });
    },

    handleDirectMessage({ toUserId, content, attachments, encrypted, clientNonce }, ack) {
      if (!toUserId) return ack({ ok: false, error: 'Recipient required' });
      if (!checkMessageRate()) return ack({ ok: false, error: 'Rate limit exceeded' });
      if (content && typeof content === 'string' && content.length > maxContentLength) {
        return ack({ ok: false, error: 'Message is too large' });
      }

      const recipient = getUserById.get(toUserId);
      if (!recipient) return ack({ ok: false, error: 'Recipient not found' });
      if (!ensureDirectMessagesAvailable(toUserId, ack)) return;
      if (encrypted && (!content || typeof content !== 'string')) {
        return ack({ ok: false, error: 'Encrypted payload required' });
      }

      const safeAttachments = normalizeAndValidateAttachments(attachments, ack);
      if (safeAttachments === null) return;

      const safeClientNonce = normalizeClientNonce(clientNonce);
      const msgId = uuidGenerator();
      let savedAttachments;
      try {
        savedAttachments = persistDMMessage({
          msgId,
          toUserId,
          content,
          encrypted,
          attachmentRefs: safeAttachments,
        });
      } catch (err) {
        return ack({ ok: false, error: err.message || 'Failed to attach uploaded file' });
      }

      const user = getUserById.get(userId);
      if (!user) return ack({ ok: false, error: 'Sender not found' });

      const message = buildDirectMessage({
        messageId: msgId,
        dmPartnerId: toUserId,
        content,
        sender: user,
        senderId: userId,
        attachments: savedAttachments,
        encrypted,
        clientNonce: safeClientNonce,
        createdAt: buildTimestamp(msgId),
      });

      io.to(`user:${toUserId}`).emit('dm:message', message);
      io.to(`user:${userId}`).emit('dm:message', message);
      runtimeMetrics.recordChatMessage('dm', {
        toUserId,
        encrypted: !!encrypted,
        attachmentCount: savedAttachments.length,
      });
      ack({ ok: true, messageId: msgId, clientNonce: safeClientNonce });
    },

    handleDirectSenderKey({ toUserId, envelope, roomId = null, distributionId = null }, ack) {
      if (!toUserId || !envelope) return ack({ ok: false, error: 'Recipient and envelope required' });
      if (!checkMessageRate()) return ack({ ok: false, error: 'Rate limit exceeded' });
      const recipient = getUserById.get(toUserId);
      if (!recipient) return ack({ ok: false, error: 'Recipient not found' });
      if (!ensureDirectMessagesAvailable(toUserId, ack)) return;
      if ((roomId !== null || distributionId !== null) && !ensureBoardsAvailable(ack)) return;
      if (typeof envelope !== 'string' || envelope.length > maxContentLength) {
        return ack({ ok: false, error: 'Invalid sender key envelope' });
      }
      const sender = getUserById.get(userId);
      const senderKeyMetadata = validateDirectSenderKeyMetadata({
        roomId,
        distributionId,
        senderRoomMember: roomId ? !!isRoomMember.get(roomId, userId) : false,
        recipientRoomMember: roomId ? !!isRoomMember.get(roomId, toUserId) : false,
      });
      if (!senderKeyMetadata.ok) {
        return ack({ ok: false, error: senderKeyMetadata.error });
      }

      let controlMessageId = null;
      if (roomId !== null || distributionId !== null) {
        controlMessageId = uuidGenerator();
        upsertSenderKeyDistribution.run(
          controlMessageId,
          roomId,
          userId,
          toUserId,
          distributionId,
          envelope
        );
      }

      io.to(`user:${toUserId}`).emit('dm:sender_key', buildDirectSenderKeyPayload({
        controlMessageId,
        fromUserId: userId,
        senderNpub: sender?.npub || null,
        envelope,
        roomId,
        distributionId,
      }));
      ack({ ok: true });
    },

    handleRoomRequestSenderKey({ roomId, senderUserId }, ack) {
      if (!ensureBoardsAvailable(ack)) return;
      if (!roomId || !senderUserId) {
        return ack({ ok: false, error: 'Room ID and sender user ID are required' });
      }
      if (!checkMessageRate()) {
        return ack({ ok: false, error: 'Rate limit exceeded' });
      }
      if (!isRoomMember.get(roomId, userId)) {
        return ack({ ok: false, error: 'Not a member of this room' });
      }
      if (!isRoomMember.get(roomId, senderUserId)) {
        return ack({ ok: false, error: 'Requested sender is not a member of this room' });
      }

      io.to(`user:${senderUserId}`).emit('room:sender_key_requested', {
        roomId,
        requestedByUserId: userId,
      });
      ack({ ok: true });
    },

    handleTypingStart({ roomId, toUserId }, ack) {
      if (!checkTypingRate()) return ack({ ok: false, error: 'Rate limit exceeded' });
      if (roomId) {
        if (!ensureBoardsAvailable(ack)) return;
        const member = isRoomMember.get(roomId, userId);
        if (!member) return ack({ ok: false, error: 'Not a member of this room' });
        socket.to(`room:${roomId}`).emit('typing:start', { userId, username, roomId });
        return ack({ ok: true });
      }
      if (toUserId) {
        if (!ensureDirectMessagesAvailable(toUserId, ack)) return;
        io.to(`user:${toUserId}`).emit('typing:start', { userId, username, toUserId });
      }
      ack({ ok: true });
    },

    handleTypingStop({ roomId, toUserId }, ack) {
      if (!checkTypingRate()) return ack({ ok: false, error: 'Rate limit exceeded' });
      if (roomId) {
        if (!ensureBoardsAvailable(ack)) return;
        const member = isRoomMember.get(roomId, userId);
        if (!member) return ack({ ok: false, error: 'Not a member of this room' });
        socket.to(`room:${roomId}`).emit('typing:stop', { userId, username, roomId });
        return ack({ ok: true });
      }
      if (toUserId) {
        if (!ensureDirectMessagesAvailable(toUserId, ack)) return;
        io.to(`user:${toUserId}`).emit('typing:stop', { userId, username, toUserId });
      }
      ack({ ok: true });
    },
  };
}

module.exports = {
  createRealtimeMessagingFlow,
};
