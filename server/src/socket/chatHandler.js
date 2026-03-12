const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const {
  db,
  insertMessage, insertEncryptedMessage, insertAttachment, getUserById,
  ensureDMConversation, deleteDMConversation, isRoomMember, usersShareGuild,
  getMessageById, updateMessageContent, deleteMessage,
  deleteMessageAttachments, getMessageAttachments,
  getUploadedFileById, getOwnedUnclaimedUploadedFile, getUploadedFilesByMessageId,
  claimUploadedFileForRoomMessage, claimUploadedFileForDMMessage,
  deleteUploadedFileRecord,
} = require('../db');

const MAX_ATTACHMENTS = 10;
const MAX_CONTENT_LENGTH = 64 * 1024; // 64KB max message content
const MAX_FILESIZE = 200 * 1024 * 1024; // 200MB
const UPLOAD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const SOCKET_RL_WINDOW = 10000;
const SOCKET_RL_MAX_MESSAGES = 30;
const SOCKET_RL_MAX_TYPING = 10;
const DM_UNAVAILABLE_ERROR = 'Direct messages are only available while you share a guild with this user.';

function handleChat(io, socket) {
  const { userId, username } = socket.handshake.auth;

  const _rl = { messages: { count: 0, reset: Date.now() + SOCKET_RL_WINDOW }, typing: { count: 0, reset: Date.now() + SOCKET_RL_WINDOW } };
  function checkRate(bucket, max) {
    const now = Date.now();
    if (now >= bucket.reset) { bucket.count = 0; bucket.reset = now + SOCKET_RL_WINDOW; }
    bucket.count++;
    return bucket.count <= max;
  }

  function canUseDirectMessages(otherUserId) {
    return !!usersShareGuild.get(userId, otherUserId);
  }

  function safe(handler) {
    return (data, ack) => {
      const done = typeof ack === 'function' ? ack : () => {};
      try {
        if (!data || typeof data !== 'object') {
          done({ ok: false, error: 'Invalid payload' });
          return;
        }
        handler(data, done);
      } catch (err) {
        console.error(`Socket handler error [${userId}]:`, err);
        done({ ok: false, error: 'Internal server error' });
      }
    };
  }

  function sanitizeAttachmentRefs(attachments) {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) return null;
    const normalized = attachments.slice(0, MAX_ATTACHMENTS).map(att => ({
      fileId: typeof att?.fileId === 'string' ? att.fileId.trim() : null,
    })).filter(att => att.fileId && UPLOAD_ID_PATTERN.test(att.fileId));
    return normalized;
  }

  function claimUploadedAttachments(messageId, attachmentRefs, scope) {
    if (!attachmentRefs || attachmentRefs.length === 0) return [];

    const savedAttachments = [];
    for (const ref of attachmentRefs) {
      const upload = getOwnedUnclaimedUploadedFile.get(ref.fileId, userId);
      if (!upload) {
        throw new Error('Attachment upload is missing, already used, or not owned by this sender');
      }
      if (upload.file_size > MAX_FILESIZE) {
        throw new Error('Attachment exceeds the maximum allowed file size');
      }

      let claimResult;
      if (scope.type === 'room') {
        claimResult = claimUploadedFileForRoomMessage.run(messageId, scope.roomId, upload.id, userId);
      } else {
        claimResult = claimUploadedFileForDMMessage.run(messageId, scope.dmUserA, scope.dmUserB, upload.id, userId);
      }

      if (!claimResult?.changes) {
        throw new Error('Failed to claim uploaded attachment for this conversation');
      }

      const attachmentId = uuidv4();
      const fileUrl = `/api/files/${upload.id}`;
      insertAttachment.run(
        attachmentId,
        messageId,
        upload.id,
        fileUrl,
        upload.file_name,
        upload.file_type,
        upload.file_size
      );
      savedAttachments.push({
        id: attachmentId,
        uploaded_file_id: upload.id,
        fileUrl,
        fileName: upload.file_name,
        fileType: upload.file_type,
        fileSize: upload.file_size,
      });
    }

    return savedAttachments;
  }

  const persistRoomMessage = db.transaction(({ msgId, roomId, content, encrypted, attachmentRefs }) => {
    if (encrypted) {
      insertEncryptedMessage.run(msgId, content, userId, roomId, null, 1);
    } else {
      insertMessage.run(msgId, content || null, userId, roomId, null);
    }
    return claimUploadedAttachments(msgId, attachmentRefs, { type: 'room', roomId });
  });

  const persistDMMessage = db.transaction(({ msgId, toUserId, content, encrypted, attachmentRefs }) => {
    if (encrypted) {
      insertEncryptedMessage.run(msgId, content, userId, null, toUserId, 1);
    } else {
      insertMessage.run(msgId, content || null, userId, null, toUserId);
    }

    const [a, b] = userId < toUserId ? [userId, toUserId] : [toUserId, userId];
    ensureDMConversation.run(a, b);
    return claimUploadedAttachments(msgId, attachmentRefs, { type: 'dm', dmUserA: a, dmUserB: b });
  });

  const deleteMessageWithUploads = db.transaction(({ messageId, senderId, uploadedFileIds }) => {
    deleteMessageAttachments.run(messageId);
    for (const uploadId of uploadedFileIds) {
      deleteUploadedFileRecord.run(uploadId);
    }

    const result = deleteMessage.run(messageId, senderId);
    if (!result?.changes) {
      throw new Error('Delete not permitted');
    }

    return result;
  });

  socket.on('room:join', safe(({ roomId }, ack) => {
    if (!roomId) return ack({ ok: false, error: 'Room ID required' });
    const member = isRoomMember.get(roomId, userId);
    if (!member) return ack({ ok: false, error: 'Not a member of this room' });
    socket.join(`room:${roomId}`);
    io.to(`room:${roomId}`).emit('room:user_joined', { roomId, userId, username });
    ack({ ok: true });
  }));

  socket.on('room:leave', safe(({ roomId }, ack) => {
    if (!roomId) return ack({ ok: false, error: 'Room ID required' });
    const member = isRoomMember.get(roomId, userId);
    socket.leave(`room:${roomId}`);
    if (member) {
      io.to(`room:${roomId}`).emit('room:user_left', { roomId, userId, username });
    }
    ack({ ok: true });
  }));

  socket.on('room:message', safe(({ roomId, content, attachments, encrypted }, ack) => {
    if (!roomId) return ack({ ok: false, error: 'Room ID required' });
    if (!checkRate(_rl.messages, SOCKET_RL_MAX_MESSAGES)) return ack({ ok: false, error: 'Rate limit exceeded' });
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return ack({ ok: false, error: 'Message is too large' });
    }
    const member = isRoomMember.get(roomId, userId);
    if (!member) return ack({ ok: false, error: 'Not a member of this room' });
    if (encrypted && (!content || typeof content !== 'string')) {
      return ack({ ok: false, error: 'Encrypted payload required' });
    }

    const safeAttachments = sanitizeAttachmentRefs(attachments);
    if (attachments && safeAttachments === null) {
      return ack({ ok: false, error: 'Invalid attachment payload' });
    }
    if (Array.isArray(attachments) && safeAttachments.length !== attachments.slice(0, MAX_ATTACHMENTS).length) {
      return ack({ ok: false, error: 'Invalid attachment reference' });
    }

    const msgId = uuidv4();
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

    const stored = getMessageById.get(msgId);
    const message = {
      id: msgId,
      content: content || null,
      sender_id: userId,
      sender_name: user.username,
      sender_color: user.avatar_color,
      sender_npub: user.npub || null,
      sender_picture: user.profile_picture || null,
      room_id: roomId,
      dm_partner_id: null,
      attachments: savedAttachments,
      created_at: stored ? stored.created_at : new Date().toISOString().replace('T', ' ').slice(0, 19),
      encrypted: encrypted ? 1 : 0,
    };

    io.to(`room:${roomId}`).emit('room:message', message);
    ack({ ok: true, messageId: msgId });
  }));

  socket.on('dm:message', safe(({ toUserId, content, attachments, encrypted }, ack) => {
    if (!toUserId) return ack({ ok: false, error: 'Recipient required' });
    if (!checkRate(_rl.messages, SOCKET_RL_MAX_MESSAGES)) return ack({ ok: false, error: 'Rate limit exceeded' });
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return ack({ ok: false, error: 'Message is too large' });
    }

    const recipient = getUserById.get(toUserId);
    if (!recipient) return ack({ ok: false, error: 'Recipient not found' });
    if (!canUseDirectMessages(toUserId)) {
      return ack({ ok: false, error: DM_UNAVAILABLE_ERROR });
    }
    if (encrypted && (!content || typeof content !== 'string')) {
      return ack({ ok: false, error: 'Encrypted payload required' });
    }

    const safeAttachments = sanitizeAttachmentRefs(attachments);
    if (attachments && safeAttachments === null) {
      return ack({ ok: false, error: 'Invalid attachment payload' });
    }
    if (Array.isArray(attachments) && safeAttachments.length !== attachments.slice(0, MAX_ATTACHMENTS).length) {
      return ack({ ok: false, error: 'Invalid attachment reference' });
    }

    const msgId = uuidv4();
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

    const stored = getMessageById.get(msgId);
    const message = {
      id: msgId,
      content: content || null,
      sender_id: userId,
      sender_name: user.username,
      sender_color: user.avatar_color,
      sender_npub: user.npub || null,
      sender_picture: user.profile_picture || null,
      room_id: null,
      dm_partner_id: toUserId,
      attachments: savedAttachments,
      created_at: stored ? stored.created_at : new Date().toISOString().replace('T', ' ').slice(0, 19),
      encrypted: encrypted ? 1 : 0,
    };

    io.to(`user:${toUserId}`).emit('dm:message', message);
    io.to(`user:${userId}`).emit('dm:message', message);
    ack({ ok: true, messageId: msgId });
  }));

  socket.on('dm:sender_key', safe(({ toUserId, envelope }, ack) => {
    if (!toUserId || !envelope) return ack({ ok: false, error: 'Recipient and envelope required' });
    if (!checkRate(_rl.messages, SOCKET_RL_MAX_MESSAGES)) return ack({ ok: false, error: 'Rate limit exceeded' });
    const recipient = getUserById.get(toUserId);
    if (!recipient) return ack({ ok: false, error: 'Recipient not found' });
    if (!canUseDirectMessages(toUserId)) {
      return ack({ ok: false, error: DM_UNAVAILABLE_ERROR });
    }
    if (typeof envelope !== 'string' || envelope.length > MAX_CONTENT_LENGTH) {
      return ack({ ok: false, error: 'Invalid sender key envelope' });
    }
    const sender = getUserById.get(userId);
    io.to(`user:${toUserId}`).emit('dm:sender_key', {
      fromUserId: userId,
      senderNpub: sender?.npub || null,
      envelope,
    });
    ack({ ok: true });
  }));

  socket.on('message:edit', safe(({ messageId, content }, ack) => {
    if (!messageId) return ack({ ok: false, error: 'Message ID required' });
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return ack({ ok: false, error: 'Message is too large' });
    }

    const existing = getMessageById.get(messageId);
    if (!existing) return ack({ ok: false, error: 'Message not found' });
    if (existing.encrypted) return ack({ ok: false, error: 'Encrypted messages cannot be edited' });

    const result = updateMessageContent.run(content, messageId, userId);
    if (result.changes === 0) return ack({ ok: false, error: 'Edit not permitted' });

    const msg = getMessageById.get(messageId);
    if (!msg) return ack({ ok: false, error: 'Message not found after edit' });

    const payload = { messageId, content: msg.content, edited_at: msg.edited_at };
    if (msg.room_id) {
      io.to(`room:${msg.room_id}`).emit('message:edited', payload);
    } else {
      io.to(`user:${msg.dm_partner_id}`).emit('message:edited', payload);
      io.to(`user:${userId}`).emit('message:edited', payload);
    }
    ack({ ok: true });
  }));

  socket.on('message:delete', safe(({ messageId }, ack) => {
    if (!messageId) return ack({ ok: false, error: 'Message ID required' });
    const msg = getMessageById.get(messageId);
    if (!msg || msg.sender_id !== userId) return ack({ ok: false, error: 'Delete not permitted' });

    const attachments = getMessageAttachments.all(messageId);
    const uploadedFiles = getUploadedFilesByMessageId.all(messageId);
    const uploadedFileIds = new Set();
    const filePathsToUnlink = new Set();

    for (const att of attachments) {
      if (att.uploaded_file_id) {
        uploadedFileIds.add(att.uploaded_file_id);
        continue;
      }
      if (att.file_url) {
        filePathsToUnlink.add(path.join(__dirname, '..', '..', 'uploads', path.basename(att.file_url)));
      }
    }

    for (const upload of uploadedFiles) {
      if (!upload?.id) continue;
      uploadedFileIds.add(upload.id);
      if (upload.stored_name) {
        filePathsToUnlink.add(path.join(__dirname, '..', '..', 'uploads', path.basename(upload.stored_name)));
      }
    }

    try {
      deleteMessageWithUploads({
        messageId,
        senderId: userId,
        uploadedFileIds: Array.from(uploadedFileIds),
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
      return ack({ ok: false, error: err.message || 'Failed to delete message' });
    }

    for (const filePath of filePathsToUnlink) {
      fs.unlink(filePath, () => {});
    }

    if (msg.room_id) {
      io.to('room:' + msg.room_id).emit('message:deleted', { messageId });
    } else {
      io.to('user:' + msg.dm_partner_id).emit('message:deleted', { messageId });
      io.to('user:' + userId).emit('message:deleted', { messageId });
    }
    ack({ ok: true });
  }));

  socket.on('dm:conversation:delete', safe(({ otherUserId }, ack) => {
    if (!otherUserId) return ack({ ok: false, error: 'Recipient required' });
    const [a, b] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
    deleteDMConversation.run(a, b, a, b);
    ack({ ok: true });
  }));

  socket.on('typing:start', safe(({ roomId, toUserId }, ack) => {
    if (!checkRate(_rl.typing, SOCKET_RL_MAX_TYPING)) return ack({ ok: false, error: 'Rate limit exceeded' });
    if (roomId) {
      const member = isRoomMember.get(roomId, userId);
      if (!member) return ack({ ok: false, error: 'Not a member of this room' });
      socket.to(`room:${roomId}`).emit('typing:start', { userId, username, roomId });
      return ack({ ok: true });
    }
    if (toUserId) {
      if (!canUseDirectMessages(toUserId)) {
        return ack({ ok: false, error: DM_UNAVAILABLE_ERROR });
      }
      io.to(`user:${toUserId}`).emit('typing:start', { userId, username, toUserId });
    }
    ack({ ok: true });
  }));

  socket.on('typing:stop', safe(({ roomId, toUserId }, ack) => {
    if (!checkRate(_rl.typing, SOCKET_RL_MAX_TYPING)) return ack({ ok: false, error: 'Rate limit exceeded' });
    if (roomId) {
      const member = isRoomMember.get(roomId, userId);
      if (!member) return ack({ ok: false, error: 'Not a member of this room' });
      socket.to(`room:${roomId}`).emit('typing:stop', { userId, username, roomId });
      return ack({ ok: true });
    }
    if (toUserId) {
      if (!canUseDirectMessages(toUserId)) {
        return ack({ ok: false, error: DM_UNAVAILABLE_ERROR });
      }
      io.to(`user:${toUserId}`).emit('typing:stop', { userId, username, toUserId });
    }
    ack({ ok: true });
  }));
}

module.exports = { handleChat };
