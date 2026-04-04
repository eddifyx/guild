export const GUILD_CHAT_FILE_LIMIT_BYTES = 25 * 1024 * 1024;
export const GUILD_CHAT_FILE_LIMIT_LABEL = '25 MB';
export const GUILD_CHAT_FILE_LIMIT_MESSAGE = `/guildchat supports files up to ${GUILD_CHAT_FILE_LIMIT_LABEL}. Use Asset Dump for larger uploads.`;

export function validateGuildChatAttachment(file) {
  if (!file) return 'File upload failed.';
  if (file.size > GUILD_CHAT_FILE_LIMIT_BYTES) {
    return GUILD_CHAT_FILE_LIMIT_MESSAGE;
  }
  return null;
}

export async function uploadGuildChatPendingFiles({
  files = [],
  sourceLabel = 'Upload',
  canCompose = false,
  composerDisabledReason = '',
  setLocalErrorFn = () => {},
  setPendingFilesFn = () => {},
  validateGuildChatAttachmentFn = validateGuildChatAttachment,
  uploadChatAttachmentFn = async () => null,
  logErrorFn = () => {},
} = {}) {
  if (!canCompose) {
    setLocalErrorFn(composerDisabledReason || '/guildchat is offline right now.');
    return { uploaded: [], failures: [composerDisabledReason || '/guildchat is offline right now.'] };
  }

  const uploadableFiles = Array.from(files || []).filter(Boolean);
  if (uploadableFiles.length === 0) {
    return { uploaded: [], failures: [] };
  }

  setLocalErrorFn('');
  const uploaded = [];
  const failures = [];

  for (const file of uploadableFiles) {
    const validationError = validateGuildChatAttachmentFn(file);
    if (validationError) {
      failures.push(validationError);
      continue;
    }
    try {
      uploaded.push(await uploadChatAttachmentFn(file));
    } catch (err) {
      logErrorFn(`[GuildChat] ${sourceLabel} failed:`, err);
      failures.push(err?.message || 'File upload failed.');
    }
  }

  if (uploaded.length > 0) {
    setPendingFilesFn((prev) => [...prev, ...uploaded]);
  }

  if (failures.length > 0) {
    setLocalErrorFn(failures[0]);
  }

  return { uploaded, failures };
}

export function applyGuildChatDraftInput({
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
  setTimeoutFn = globalThis.window?.setTimeout?.bind(globalThis.window) || globalThis.setTimeout,
  typingStopDelayMs = 2500,
  event = null,
} = {}) {
  setDraftFn(nextValue);
  syncComposerSelectionFn(event);
  if (localError) setLocalErrorFn('');

  if (nextValue.trim()) {
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      emitTypingFn(true);
    }
    clearTypingTimerFn();
    typingTimeoutRef.current = setTimeoutFn(() => {
      typingActiveRef.current = false;
      emitTypingFn(false);
      typingTimeoutRef.current = null;
    }, typingStopDelayMs);
    return true;
  }

  stopTypingFn();
  return false;
}

export function applyGuildChatMentionSelection({
  suggestion = null,
  activeMentionSearch = null,
  draft = '',
  setDraftFn = () => {},
  setSelectedMentionSuggestionIndexFn = () => {},
  inputRef = { current: null },
  setComposerSelectionFn = () => {},
  requestAnimationFrameFn = globalThis.window?.requestAnimationFrame?.bind(globalThis.window) || ((callback) => callback()),
} = {}) {
  if (!suggestion || !activeMentionSearch) return null;

  const nextDraft = [
    draft.slice(0, activeMentionSearch.replaceStart),
    `${suggestion.mentionToken} `,
    draft.slice(activeMentionSearch.replaceEnd),
  ].join('');
  const nextCaret = activeMentionSearch.replaceStart + suggestion.mentionToken.length + 1;

  setDraftFn(nextDraft);
  setSelectedMentionSuggestionIndexFn(0);
  requestAnimationFrameFn(() => {
    const input = inputRef.current;
    if (!input || typeof input.focus !== 'function' || typeof input.setSelectionRange !== 'function') return;
    input.focus();
    input.setSelectionRange(nextCaret, nextCaret);
    setComposerSelectionFn({ start: nextCaret, end: nextCaret });
  });

  return {
    nextDraft,
    nextCaret,
  };
}

export async function sendGuildChatComposerMessage({
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
  sendMessageFn = async () => {},
  requestAnimationFrameFn = globalThis.window?.requestAnimationFrame?.bind(globalThis.window) || ((callback) => callback()),
  focusInputFn = () => {},
} = {}) {
  const normalizedDraft = draft.trim();
  const attachmentsToSend = pendingFilesRef.current;
  if ((!normalizedDraft && attachmentsToSend.length === 0) || sending) return false;
  if (!canCompose) {
    setLocalErrorFn(composerDisabledReason || 'You do not have permission to post in /guildchat.');
    return false;
  }

  setSendingFn(true);
  const previousDraft = draft;
  const previousFiles = attachmentsToSend;
  setDraftFn('');
  setPendingFilesFn([]);
  setLocalErrorFn('');
  stopTypingFn();
  requestAnimationFrameFn(() => focusInputFn());

  try {
    await sendMessageFn(normalizedDraft, previousFiles);
    return true;
  } catch {
    setDraftFn((currentDraft) => currentDraft || previousDraft);
    setPendingFilesFn((currentFiles) => currentFiles.length > 0 ? currentFiles : previousFiles);
    return false;
  } finally {
    setSendingFn(false);
    requestAnimationFrameFn(() => focusInputFn());
  }
}

export function handleGuildChatComposerKeyEvent({
  event = null,
  mentionSuggestions = [],
  selectedMentionSuggestionIndex = 0,
  setSelectedMentionSuggestionIndexFn = () => {},
  applyMentionSuggestionFn = () => {},
  handleSendFn = () => {},
  setComposerSelectionFn = () => {},
} = {}) {
  if (event?.nativeEvent?.isComposing) return null;

  if (mentionSuggestions.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedMentionSuggestionIndexFn((currentIndex) => (
        currentIndex + 1 >= mentionSuggestions.length ? 0 : currentIndex + 1
      ));
      return 'mention-next';
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedMentionSuggestionIndexFn((currentIndex) => (
        currentIndex - 1 < 0 ? mentionSuggestions.length - 1 : currentIndex - 1
      ));
      return 'mention-prev';
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const selectedSuggestion = mentionSuggestions[selectedMentionSuggestionIndex] || mentionSuggestions[0];
      if (selectedSuggestion) {
        event.preventDefault();
        applyMentionSuggestionFn(selectedSuggestion);
        return 'mention-apply';
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setComposerSelectionFn(({ start }) => ({ start, end: start }));
      return 'mention-cancel';
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void handleSendFn();
    return 'send';
  }

  return null;
}
