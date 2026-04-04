export function hasGuildChatFileDrag(event) {
  return Array.from(event?.dataTransfer?.types || []).includes('Files');
}

export function extractGuildChatClipboardImages(event) {
  const items = event?.clipboardData?.items;
  if (!items) return [];

  const imageFiles = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  return imageFiles;
}

export async function handleGuildChatPasteUpload({
  event = null,
  uploadPendingFilesFn = async () => {},
} = {}) {
  const imageFiles = extractGuildChatClipboardImages(event);
  if (imageFiles.length === 0) return false;

  event.preventDefault();
  await uploadPendingFilesFn(imageFiles, 'Paste');
  return true;
}

export function handleGuildChatDragEnter({
  event = null,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
  hasFileDragFn = hasGuildChatFileDrag,
} = {}) {
  if (!hasFileDragFn(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  dragDepthRef.current += 1;
  setDragActiveFn(true);
  return true;
}

export function handleGuildChatDragOver({
  event = null,
  dragActive = false,
  setDragActiveFn = () => {},
  hasFileDragFn = hasGuildChatFileDrag,
} = {}) {
  if (!hasFileDragFn(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  if (!dragActive) {
    setDragActiveFn(true);
  }
  return true;
}

export function handleGuildChatDragLeave({
  event = null,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
  hasFileDragFn = hasGuildChatFileDrag,
} = {}) {
  if (!hasFileDragFn(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
  if (dragDepthRef.current === 0) {
    setDragActiveFn(false);
  }
  return true;
}

export function handleGuildChatFileDrop({
  event = null,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
  uploadPendingFilesFn = async () => {},
  hasFileDragFn = hasGuildChatFileDrag,
} = {}) {
  if (!hasFileDragFn(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  dragDepthRef.current = 0;
  setDragActiveFn(false);
  const droppedFiles = Array.from(event.dataTransfer?.files || []).filter(Boolean);
  if (droppedFiles.length === 0) return true;
  void uploadPendingFilesFn(droppedFiles, 'Drop');
  return true;
}

export async function removeGuildChatPendingUpload({
  index = -1,
  pendingFilesRef = { current: [] },
  setPendingFilesFn = () => {},
  revokePreviewFn = () => {},
  deleteChatAttachmentUploadFn = async () => {},
  warnFn = () => {},
} = {}) {
  const file = pendingFilesRef.current[index];
  setPendingFilesFn((prev) => prev.filter((_, i) => i !== index));
  revokePreviewFn(file);
  try {
    await deleteChatAttachmentUploadFn(file);
    return true;
  } catch (err) {
    warnFn('[GuildChat] Failed to delete pending upload:', err?.message || err);
    return false;
  }
}
