import { useEffect } from 'react';

import { revokePendingPreview } from './messageInputModel.mjs';

export function useMessageInputRuntimeEffects({
  pendingFiles,
  pendingFilesRef,
  emitTypingFn,
  typingRef,
  typingTimeoutRef,
  clearTimeoutFn = clearTimeout,
  textareaRef,
  text,
  conversation,
  requestAnimationFrameFn = requestAnimationFrame,
  cancelAnimationFrameFn = cancelAnimationFrame,
}) {
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles, pendingFilesRef]);

  useEffect(() => () => {
    clearTimeoutFn(typingTimeoutRef.current);
    if (typingRef.current) {
      typingRef.current = false;
      emitTypingFn(false);
    }
    pendingFilesRef.current.forEach(revokePendingPreview);
  }, [clearTimeoutFn, emitTypingFn, pendingFilesRef, typingRef, typingTimeoutRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [text, textareaRef]);

  useEffect(() => {
    if (!conversation?.id || !conversation?.type) return undefined;
    const frameId = requestAnimationFrameFn(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const length = textarea.value?.length || 0;
      textarea.setSelectionRange(length, length);
    });
    return () => cancelAnimationFrameFn(frameId);
  }, [
    cancelAnimationFrameFn,
    conversation?.id,
    conversation?.type,
    requestAnimationFrameFn,
    textareaRef,
  ]);
}
