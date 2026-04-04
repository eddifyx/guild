import {
  deleteChatAttachmentUpload,
  uploadChatAttachment,
} from '../../utils/chatUploads.js';

export function buildGuildChatDockControllerRuntimeGuildChatInput({
  guildChat = {},
} = {}) {
  const {
    sendMessage = async () => null,
    emitTyping = () => {},
  } = guildChat || {};

  return {
    sendMessageFn: sendMessage,
    emitTypingFn: emitTyping,
    uploadChatAttachmentFn: uploadChatAttachment,
    deleteChatAttachmentUploadFn: deleteChatAttachmentUpload,
    logErrorFn: console.error,
    warnFn: console.warn,
  };
}

export function buildGuildChatDockControllerRuntimeStateInput({
  state = {},
  viewState = {},
} = {}) {
  return {
    draft: state.draft,
    sending: state.sending,
    canCompose: viewState.canCompose,
    composerDisabledReason: viewState.composerDisabledReason,
    localError: state.localError,
    dragActive: state.dragActive,
    setDraftFn: state.setDraft,
    setSendingFn: state.setSending,
    setPendingFilesFn: state.setPendingFiles,
    setLocalErrorFn: state.setLocalError,
    setComposerSelectionFn: state.setComposerSelection,
    setSelectedMentionSuggestionIndexFn: state.setSelectedMentionSuggestionIndex,
    setDragActiveFn: state.setDragActive,
  };
}

export function buildGuildChatDockControllerRuntimeRefsInput({
  state = {},
} = {}) {
  return {
    inputRef: state.inputRef,
    pendingFilesRef: state.pendingFilesRef,
    typingActiveRef: state.typingActiveRef,
    typingTimeoutRef: state.typingTimeoutRef,
    dragDepthRef: state.dragDepthRef,
  };
}

export function buildGuildChatDockControllerRuntimeMentionInput({
  state = {},
  viewState = {},
} = {}) {
  return {
    mentionSuggestions: viewState.mentionSuggestions,
    selectedMentionSuggestionIndex: state.selectedMentionSuggestionIndex,
    activeMentionSearch: viewState.activeMentionSearch,
  };
}

export function buildGuildChatDockControllerRuntimeHelpersInput({
  effects = {},
} = {}) {
  return {
    syncComposerSelectionFn: effects.syncComposerSelection,
    clearTypingTimerFn: effects.clearTypingTimer,
    stopTypingFn: effects.stopTyping,
  };
}

export function buildUseGuildChatDockControllerRuntimeInput({
  guildChat,
  state,
  viewState,
  effects,
} = {}) {
  return {
    guildChat: buildGuildChatDockControllerRuntimeGuildChatInput({
      guildChat,
    }),
    state: buildGuildChatDockControllerRuntimeStateInput({
      state,
      viewState,
    }),
    refs: buildGuildChatDockControllerRuntimeRefsInput({
      state,
    }),
    mentionState: buildGuildChatDockControllerRuntimeMentionInput({
      state,
      viewState,
    }),
    runtime: buildGuildChatDockControllerRuntimeHelpersInput({
      effects,
    }),
  };
}
