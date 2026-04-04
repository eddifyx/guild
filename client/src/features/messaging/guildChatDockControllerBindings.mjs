export function buildGuildChatDraftChangeOptions({
  nextValue = '',
  localError = '',
  setDraftFn = () => {},
  syncComposerSelectionFn = () => {},
  setLocalErrorFn = () => {},
  typingActiveRef = { current: false },
  emitTypingFn = () => {},
  clearTypingTimerFn = () => {},
  typingTimeoutRef = { current: null },
  stopTypingFn = () => {},
  event = null,
} = {}) {
  return {
    nextValue,
    localError,
    setDraftFn,
    syncComposerSelectionFn,
    setLocalErrorFn,
    typingActiveRef,
    emitTypingFn,
    clearTypingTimerFn,
    typingTimeoutRef,
    stopTypingFn,
    event,
  };
}

export function buildGuildChatMentionSelectionOptions({
  suggestion = null,
  activeMentionSearch = null,
  draft = '',
  setDraftFn = () => {},
  setSelectedMentionSuggestionIndexFn = () => {},
  inputRef = { current: null },
  setComposerSelectionFn = () => {},
} = {}) {
  return {
    suggestion,
    activeMentionSearch,
    draft,
    setDraftFn,
    setSelectedMentionSuggestionIndexFn,
    inputRef,
    setComposerSelectionFn,
  };
}

export function buildGuildChatUploadPendingFilesOptions({
  files = [],
  sourceLabel = 'Upload',
  canCompose = false,
  composerDisabledReason = '',
  setLocalErrorFn = () => {},
  setPendingFilesFn = () => {},
  validateGuildChatAttachmentFn = () => null,
  uploadChatAttachmentFn = async () => null,
  logErrorFn = () => {},
} = {}) {
  return {
    files,
    sourceLabel,
    canCompose,
    composerDisabledReason,
    setLocalErrorFn,
    setPendingFilesFn,
    validateGuildChatAttachmentFn,
    uploadChatAttachmentFn,
    logErrorFn,
  };
}

export function buildGuildChatPasteUploadOptions({
  event = null,
  uploadPendingFilesFn = async () => {},
} = {}) {
  return {
    event,
    uploadPendingFilesFn,
  };
}

export function buildGuildChatFileDropOptions({
  event = null,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
  uploadPendingFilesFn = async () => {},
} = {}) {
  return {
    event,
    dragDepthRef,
    setDragActiveFn,
    uploadPendingFilesFn,
  };
}

export function buildGuildChatRemovePendingUploadOptions({
  index = -1,
  pendingFilesRef = { current: [] },
  setPendingFilesFn = () => {},
  revokePreviewFn = () => {},
  deleteChatAttachmentUploadFn = async () => {},
  warnFn = () => {},
} = {}) {
  return {
    index,
    pendingFilesRef,
    setPendingFilesFn,
    revokePreviewFn,
    deleteChatAttachmentUploadFn,
    warnFn,
  };
}

export function buildGuildChatSendMessageOptions({
  draft = '',
  sending = false,
  canCompose = false,
  composerDisabledReason = '',
  pendingFilesRef = { current: [] },
  setLocalErrorFn = () => {},
  setSendingFn = () => {},
  setDraftFn = () => {},
  setPendingFilesFn = () => {},
  stopTypingFn = () => {},
  sendMessageFn = async () => null,
  focusInputFn = () => {},
} = {}) {
  return {
    draft,
    sending,
    canCompose,
    composerDisabledReason,
    pendingFilesRef,
    setLocalErrorFn,
    setSendingFn,
    setDraftFn,
    setPendingFilesFn,
    stopTypingFn,
    sendMessageFn,
    focusInputFn,
  };
}

export function buildGuildChatComposerKeyOptions({
  event = null,
  mentionSuggestions = [],
  selectedMentionSuggestionIndex = 0,
  setSelectedMentionSuggestionIndexFn = () => {},
  applyMentionSuggestionFn = () => {},
  handleSendFn = async () => {},
  setComposerSelectionFn = () => {},
} = {}) {
  return {
    event,
    mentionSuggestions,
    selectedMentionSuggestionIndex,
    setSelectedMentionSuggestionIndexFn,
    applyMentionSuggestionFn,
    handleSendFn,
    setComposerSelectionFn,
  };
}
