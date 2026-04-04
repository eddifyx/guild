export function restoreFailedSendDraft({
  draftText = '',
  draftFiles = [],
  setTextFn = () => {},
  pendingFilesRef = { current: [] },
  setPendingFilesFn = () => {},
  setInputErrorFn = () => {},
  focusFn = () => {},
  error = null,
}) {
  setTextFn((current) => (current ? current : draftText));
  pendingFilesRef.current = draftFiles;
  setPendingFilesFn((current) => (current.length > 0 ? current : draftFiles));
  setInputErrorFn(error?.message || 'Secure send failed. Try again.');
  focusFn();
}

export function createMessageInputSendHandler({
  getSending = () => false,
  setSendingFn = () => {},
  getText = () => '',
  getPendingFiles = () => [],
  setInputErrorFn = () => {},
  setTextFn = () => {},
  pendingFilesRef = { current: [] },
  setPendingFilesFn = () => {},
  typingRef = { current: false },
  typingTimeoutRef = { current: null },
  emitTypingFn = () => {},
  clearTimeoutFn = clearTimeout,
  requestAnimationFrameFn = (callback) => callback(),
  focusFn = () => {},
  onSend = async () => {},
  restoreFailedSendDraftFn = restoreFailedSendDraft,
}) {
  return async function handleSend() {
    if (getSending()) return;

    const draftText = getText();
    const trimmed = draftText.trim();
    const draftFiles = getPendingFiles();
    if (!trimmed && draftFiles.length === 0) return;

    setInputErrorFn('');
    setSendingFn(true);
    setTextFn('');
    pendingFilesRef.current = [];
    setPendingFilesFn([]);
    typingRef.current = false;
    clearTimeoutFn(typingTimeoutRef.current);
    emitTypingFn(false);
    requestAnimationFrameFn(() => focusFn());

    try {
      await onSend(trimmed || null, draftFiles.length > 0 ? draftFiles : undefined);
    } catch (error) {
      restoreFailedSendDraftFn({
        draftText,
        draftFiles,
        setTextFn,
        pendingFilesRef,
        setPendingFilesFn,
        setInputErrorFn,
        focusFn,
        error,
      });
    } finally {
      setSendingFn(false);
    }
  };
}
