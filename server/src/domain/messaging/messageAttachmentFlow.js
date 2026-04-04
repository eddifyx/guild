function createMessageAttachmentFlow({
  userId,
  maxAttachments = 10,
  maxAttachmentFileSize = 100 * 1024 * 1024,
  maxGuildChatFileSize = 25 * 1024 * 1024,
  uploadIdPattern = /^[0-9a-f-]{36}$/i,
  uuidGenerator,
  getOwnedUnclaimedUploadedFile,
  claimUploadedFileForRoomMessage,
  claimUploadedFileForDMMessage,
  claimUploadedFileForGuildChatMessage,
  insertAttachment,
} = {}) {
  function sanitizeAttachmentRefs(attachments) {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) return null;
    return attachments
      .slice(0, maxAttachments)
      .map((attachment) => ({
        fileId: typeof attachment?.fileId === 'string' ? attachment.fileId.trim() : null,
      }))
      .filter((attachment) => attachment.fileId && uploadIdPattern.test(attachment.fileId));
  }

  function sanitizeGuildChatAttachmentRefs(attachments) {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) return null;

    const normalized = attachments.slice(0, maxAttachments).map((attachment) => {
      const fileId = typeof attachment?.fileId === 'string' ? attachment.fileId.trim() : '';
      const encryptionKey = typeof attachment?.encryptionKey === 'string' ? attachment.encryptionKey.trim() : '';
      const encryptionDigest = typeof attachment?.encryptionDigest === 'string' ? attachment.encryptionDigest.trim() : '';
      const originalFileName = typeof attachment?.originalFileName === 'string' ? attachment.originalFileName.trim().slice(0, 255) : '';
      const originalFileType = typeof attachment?.originalFileType === 'string' ? attachment.originalFileType.trim().slice(0, 128) : '';
      const originalFileSize = Number.isFinite(Number(attachment?.originalFileSize))
        ? Math.max(0, Number(attachment.originalFileSize))
        : null;

      if (!fileId || !uploadIdPattern.test(fileId)) return null;

      return {
        fileId,
        encryptionKey: encryptionKey || null,
        encryptionDigest: encryptionDigest || null,
        originalFileName: originalFileName || null,
        originalFileType: originalFileType || null,
        originalFileSize,
      };
    });

    if (normalized.some((attachment) => !attachment)) return null;
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
      if (upload.file_size > maxAttachmentFileSize) {
        throw new Error('Attachments support files up to 100 MB.');
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

      const attachmentId = uuidGenerator();
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

  function claimGuildChatAttachments(messageId, guildId, attachmentRefs) {
    if (!attachmentRefs || attachmentRefs.length === 0) return [];

    const savedAttachments = [];
    for (const ref of attachmentRefs) {
      const upload = getOwnedUnclaimedUploadedFile.get(ref.fileId, userId);
      if (!upload) {
        throw new Error('Attachment upload is missing, already used, or not owned by this sender');
      }
      if (upload.file_size > maxGuildChatFileSize) {
        throw new Error('/guildchat supports files up to 25 MB. Use Asset Dump for larger uploads.');
      }

      const claimResult = claimUploadedFileForGuildChatMessage.run(messageId, guildId, upload.id, userId);
      if (!claimResult?.changes) {
        throw new Error('Failed to attach uploaded file to /guildchat');
      }

      savedAttachments.push({
        id: upload.id,
        uploaded_file_id: upload.id,
        fileUrl: `/api/files/${upload.id}`,
        serverFileUrl: `/api/files/${upload.id}`,
        fileName: upload.file_name,
        fileType: upload.file_type,
        fileSize: upload.file_size,
        originalFileName: ref.originalFileName || upload.file_name,
        originalFileType: ref.originalFileType || upload.file_type,
        originalFileSize: ref.originalFileSize ?? upload.file_size,
        encryptionKey: ref.encryptionKey,
        encryptionDigest: ref.encryptionDigest,
        _storedName: upload.stored_name,
      });
    }

    return savedAttachments;
  }

  return {
    claimGuildChatAttachments,
    claimUploadedAttachments,
    sanitizeAttachmentRefs,
    sanitizeGuildChatAttachmentRefs,
  };
}

module.exports = {
  createMessageAttachmentFlow,
};
