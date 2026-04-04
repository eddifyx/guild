export function revokeAttachmentPreviewUrls(attachments = []) {
  for (const attachment of attachments || []) {
    if (attachment?._previewUrl) {
      URL.revokeObjectURL(attachment._previewUrl);
    }
  }
}

export function clearConversationMessages(messages = [], {
  revokeAttachmentPreviewUrlsFn = revokeAttachmentPreviewUrls,
} = {}) {
  for (const message of messages || []) {
    revokeAttachmentPreviewUrlsFn(message?._decryptedAttachments);
  }
}

export function clearAllMessageCaches({
  clearDecryptedMessageCachesFn,
  clearConversationCacheStateFn,
  clearMessageDecryptRuntimeFn,
  revokeAttachmentPreviewUrlsFn = revokeAttachmentPreviewUrls,
} = {}) {
  clearDecryptedMessageCachesFn?.({ revokeAttachmentPreviewUrlsFn });
  clearConversationCacheStateFn?.({
    clearConversationMessagesFn: (messages) => clearConversationMessages(messages, {
      revokeAttachmentPreviewUrlsFn,
    }),
  });
  clearMessageDecryptRuntimeFn?.();
}

export function resetMessageLaneState({
  pendingSentMessages,
  clearAllMessageCachesFn,
  revokeAttachmentPreviewUrlsFn = revokeAttachmentPreviewUrls,
  clearDeferredRoomSenderKeySyncFn,
  messagesRef,
  prevConvRef,
  setMessagesFn,
  setHasMoreFn,
  setErrorFn,
  setLoadingFn,
} = {}) {
  clearAllMessageCachesFn?.();
  for (const pending of pendingSentMessages?.values?.() || []) {
    revokeAttachmentPreviewUrlsFn(pending?.attachments);
  }
  pendingSentMessages?.clear?.();
  clearDeferredRoomSenderKeySyncFn?.();
  if (messagesRef) messagesRef.current = [];
  if (prevConvRef) prevConvRef.current = null;
  setMessagesFn?.([]);
  setHasMoreFn?.(true);
  setErrorFn?.('');
  setLoadingFn?.(false);
}
