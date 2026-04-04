function createMessageLifecycleFlow({
  io,
  userId,
  maxContentLength,
  getMessageById,
  updateMessageContent,
  getMessageAttachments,
  getUploadedFilesByMessageId,
  deleteMessageWithUploads,
  deleteDMConversation,
  buildUploadFilePath,
  unlinkFile,
} = {}) {
  function buildMessageDeleteTargets(messageId) {
    const attachments = getMessageAttachments.all(messageId);
    const uploadedFiles = getUploadedFilesByMessageId.all(messageId);
    const uploadedFileIds = new Set();
    const filePathsToUnlink = new Set();

    for (const attachment of attachments) {
      if (attachment.uploaded_file_id) {
        uploadedFileIds.add(attachment.uploaded_file_id);
        continue;
      }
      if (attachment.file_url) {
        filePathsToUnlink.add(buildUploadFilePath(attachment.file_url));
      }
    }

    for (const upload of uploadedFiles) {
      if (!upload?.id) continue;
      uploadedFileIds.add(upload.id);
      if (upload.stored_name) {
        filePathsToUnlink.add(buildUploadFilePath(upload.stored_name));
      }
    }

    return {
      uploadedFileIds: Array.from(uploadedFileIds),
      filePathsToUnlink: Array.from(filePathsToUnlink),
    };
  }

  return {
    handleEdit({ messageId, content }, ack) {
      if (!messageId) return ack({ ok: false, error: 'Message ID required' });
      if (content && typeof content === 'string' && content.length > maxContentLength) {
        return ack({ ok: false, error: 'Message is too large' });
      }

      const existing = getMessageById.get(messageId);
      if (!existing) return ack({ ok: false, error: 'Message not found' });
      if (existing.encrypted) return ack({ ok: false, error: 'Encrypted messages cannot be edited' });

      const result = updateMessageContent.run(content, messageId, userId);
      if (result.changes === 0) return ack({ ok: false, error: 'Edit not permitted' });

      const message = getMessageById.get(messageId);
      if (!message) return ack({ ok: false, error: 'Message not found after edit' });

      const payload = { messageId, content: message.content, edited_at: message.edited_at };
      if (message.room_id) {
        io.to(`room:${message.room_id}`).emit('message:edited', payload);
      } else {
        io.to(`user:${message.dm_partner_id}`).emit('message:edited', payload);
        io.to(`user:${userId}`).emit('message:edited', payload);
      }
      ack({ ok: true });
    },

    handleDelete({ messageId }, ack) {
      if (!messageId) return ack({ ok: false, error: 'Message ID required' });
      const message = getMessageById.get(messageId);
      if (!message || message.sender_id !== userId) return ack({ ok: false, error: 'Delete not permitted' });

      const { uploadedFileIds, filePathsToUnlink } = buildMessageDeleteTargets(messageId);
      try {
        deleteMessageWithUploads({
          messageId,
          senderId: userId,
          uploadedFileIds,
        });
      } catch (err) {
        console.error('Failed to delete message:', err);
        return ack({ ok: false, error: err.message || 'Failed to delete message' });
      }

      for (const filePath of filePathsToUnlink) {
        unlinkFile(filePath);
      }

      if (message.room_id) {
        io.to(`room:${message.room_id}`).emit('message:deleted', { messageId });
      } else {
        io.to(`user:${message.dm_partner_id}`).emit('message:deleted', { messageId });
        io.to(`user:${userId}`).emit('message:deleted', { messageId });
      }
      ack({ ok: true });
    },

    handleDeleteConversation({ otherUserId }, ack) {
      if (!otherUserId) return ack({ ok: false, error: 'Recipient required' });
      const [a, b] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
      deleteDMConversation.run(a, b, a, b);
      ack({ ok: true });
    },
  };
}

module.exports = {
  createMessageLifecycleFlow,
};
