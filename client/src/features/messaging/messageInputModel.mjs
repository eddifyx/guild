export function revokePendingPreview(file) {
  if (file?._previewUrl) {
    URL.revokeObjectURL(file._previewUrl);
  }
}

export function hasFileDrag(dataTransfer) {
  if (!dataTransfer?.types) return false;
  return Array.from(dataTransfer.types).includes('Files');
}

export function getMessageInputActiveState({
  text = '',
  pendingFiles = [],
  uploading = false,
} = {}) {
  return (text.trim().length > 0 || pendingFiles.length > 0) && !uploading;
}

export function getMessageInputPlaceholder({ uploading = false } = {}) {
  return uploading ? 'Uploading encrypted image...' : 'Type a message...';
}

export function getMessageInputTypingPayload(conversation) {
  if (!conversation?.id || !conversation?.type) return null;
  return conversation.type === 'room'
    ? { roomId: conversation.id, toUserId: null }
    : { roomId: null, toUserId: conversation.id };
}
