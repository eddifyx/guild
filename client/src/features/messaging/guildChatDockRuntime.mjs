function isGuildChatInputLike(input) {
  return !!input && typeof input.value === 'string';
}

export function focusGuildChatComposer({
  inputRef = { current: null },
  setComposerSelectionFn = () => {},
  requestAnimationFrameFn = (callback) => callback(),
} = {}) {
  requestAnimationFrameFn(() => {
    const input = inputRef?.current;
    if (!isGuildChatInputLike(input)) return;
    input.focus?.();
    const caret = input.value.length;
    input.setSelectionRange?.(caret, caret);
    setComposerSelectionFn({ start: caret, end: caret });
  });
  return true;
}

export function syncGuildChatComposerSelection({
  eventOrInput = null,
  inputRef = { current: null },
  setComposerSelectionFn = () => {},
} = {}) {
  const input = eventOrInput?.target && isGuildChatInputLike(eventOrInput.target)
    ? eventOrInput.target
    : isGuildChatInputLike(eventOrInput)
      ? eventOrInput
      : inputRef?.current;
  if (!isGuildChatInputLike(input)) return null;

  const selection = {
    start: input.selectionStart ?? input.value.length,
    end: input.selectionEnd ?? input.value.length,
  };
  setComposerSelectionFn(selection);
  return selection;
}

export function scrollGuildChatFeedToBottom({
  feedRef = { current: null },
  stickToBottomRef = { current: false },
} = {}) {
  const feed = feedRef?.current;
  if (!feed) return false;
  feed.scrollTop = feed.scrollHeight;
  stickToBottomRef.current = true;
  return true;
}

export function updateGuildChatStickToBottom({
  feedRef = { current: null },
  stickToBottomRef = { current: false },
  threshold = 36,
} = {}) {
  const feed = feedRef?.current;
  if (!feed) return false;
  const shouldStick = (feed.scrollHeight - feed.scrollTop - feed.clientHeight) < threshold;
  stickToBottomRef.current = shouldStick;
  return shouldStick;
}

export function resetGuildChatDragStateWhenHidden({
  hidden = false,
  dragActive = false,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
} = {}) {
  if (!hidden || !dragActive) return false;
  dragDepthRef.current = 0;
  setDragActiveFn(false);
  return true;
}

export function cleanupGuildChatPendingUploads({
  pendingFilesRef = { current: [] },
  revokePendingPreviewFn = () => {},
  deleteChatAttachmentUploadFn = async () => {},
} = {}) {
  const pendingFiles = Array.isArray(pendingFilesRef?.current) ? pendingFilesRef.current : [];
  pendingFiles.forEach((file) => {
    revokePendingPreviewFn(file);
    void deleteChatAttachmentUploadFn(file).catch(() => {});
  });
  return pendingFiles.length;
}
