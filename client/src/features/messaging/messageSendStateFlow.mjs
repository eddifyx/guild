export function buildSecureAttachmentState(attachments) {
  if (!attachments || attachments.length === 0) {
    return {
      encryptedAttachmentMeta: null,
      attachmentRefs: null,
      pendingAttachments: null,
    };
  }

  const unencrypted = attachments.filter((attachment) => !attachment?._encrypted);
  if (unencrypted.length > 0) {
    throw new Error(`Cannot send ${unencrypted.length} unencrypted attachment(s) while secure messaging is active.`);
  }

  const missingUploads = attachments.filter((attachment) => !attachment?.fileId);
  if (missingUploads.length > 0) {
    throw new Error('One or more attachments lost their upload reference. Re-upload and try again.');
  }

  const pendingAttachments = attachments.map((attachment) => ({
    serverFileUrl: attachment.fileUrl || attachment.file_url,
    encryptionKey: attachment._encryptionKey,
    encryptionDigest: attachment._encryptionDigest,
    originalFileName: attachment._originalName,
    originalFileType: attachment._originalType,
    originalFileSize: attachment._originalSize,
    _previewUrl: attachment._previewUrl || null,
  }));

  return {
    encryptedAttachmentMeta: pendingAttachments.map(({ _previewUrl, ...persistableAttachment }) => persistableAttachment),
    attachmentRefs: attachments.map((attachment) => ({ fileId: attachment.fileId })),
    pendingAttachments,
  };
}

export function createOptimisticSecureMessage({
  clientNonce,
  content,
  pendingAttachments,
  conversation,
  user,
  createConversationTimestampFn = () => new Date().toISOString(),
} = {}) {
  return {
    id: `optimistic:${clientNonce}`,
    client_nonce: clientNonce,
    _clientNonce: clientNonce,
    content,
    sender_id: user?.userId,
    sender_name: user?.username || 'You',
    sender_color: user?.avatarColor || '#40FF40',
    sender_picture: user?.profilePicture || null,
    sender_npub: user?.npub || null,
    room_id: conversation?.type === 'room' ? conversation.id : null,
    dm_partner_id: conversation?.type === 'dm' ? conversation.id : null,
    attachments: [],
    created_at: createConversationTimestampFn(),
    encrypted: 1,
    _decrypted: true,
    _decryptedAttachments: pendingAttachments,
    _optimistic: true,
  };
}

export function removeOptimisticMessageByNonce(messages = [], clientNonce) {
  return (messages || []).filter((message) => (
    (message?.client_nonce || message?._clientNonce || null) !== clientNonce
  ));
}
