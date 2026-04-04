function createMessagePersistenceFlow({
  db,
  userId,
  insertMessage,
  insertEncryptedMessage,
  ensureDMConversation,
  deleteMessageAttachments,
  deleteUploadedFileRecord,
  deleteMessage,
  claimUploadedAttachments,
} = {}) {
  const persistRoomMessage = db.transaction(({ msgId, roomId, content, encrypted, attachmentRefs }) => {
    if (encrypted) {
      insertEncryptedMessage.run(msgId, content, userId, roomId, null, 1);
    } else {
      insertMessage.run(msgId, content || null, userId, roomId, null);
    }
    return claimUploadedAttachments(msgId, attachmentRefs, { type: 'room', roomId });
  });

  const persistDirectMessage = db.transaction(({ msgId, toUserId, content, encrypted, attachmentRefs }) => {
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

  return {
    deleteMessageWithUploads,
    persistDirectMessage,
    persistRoomMessage,
  };
}

module.exports = {
  createMessagePersistenceFlow,
};
