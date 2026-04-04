import { useCallback } from 'react';

import {
  applyGuildChatDraftInput,
  sendGuildChatComposerMessage,
} from './guildChatComposerFlow.mjs';
import {
  buildGuildChatDraftChangeOptions,
  buildGuildChatSendMessageOptions,
} from './guildChatDockControllerBindings.mjs';

export function useGuildChatDockControllerDraftRuntime({
  guildChat = {},
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const {
    sendMessageFn = async () => null,
    emitTypingFn = () => {},
  } = guildChat;

  const {
    draft = '',
    sending = false,
    canCompose = false,
    composerDisabledReason = '',
    localError = '',
    setDraftFn = () => {},
    setSendingFn = () => {},
    setPendingFilesFn = () => {},
    setLocalErrorFn = () => {},
  } = state;

  const {
    inputRef = { current: null },
    pendingFilesRef = { current: [] },
    typingActiveRef = { current: false },
    typingTimeoutRef = { current: null },
  } = refs;

  const {
    syncComposerSelectionFn = () => {},
    clearTypingTimerFn = () => {},
    stopTypingFn = () => {},
  } = runtime;

  const handleDraftChange = useCallback((event) => {
    applyGuildChatDraftInput(buildGuildChatDraftChangeOptions({
      nextValue: event.target.value,
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
    }));
  }, [
    clearTypingTimerFn,
    emitTypingFn,
    localError,
    setDraftFn,
    setLocalErrorFn,
    stopTypingFn,
    syncComposerSelectionFn,
    typingActiveRef,
    typingTimeoutRef,
  ]);

  const handleSend = useCallback(async () => {
    await sendGuildChatComposerMessage(buildGuildChatSendMessageOptions({
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
      focusInputFn: () => inputRef.current?.focus(),
    }));
  }, [
    canCompose,
    composerDisabledReason,
    draft,
    inputRef,
    pendingFilesRef,
    sendMessageFn,
    sending,
    setDraftFn,
    setLocalErrorFn,
    setPendingFilesFn,
    setSendingFn,
    stopTypingFn,
  ]);

  return {
    handleDraftChange,
    handleSend,
  };
}
