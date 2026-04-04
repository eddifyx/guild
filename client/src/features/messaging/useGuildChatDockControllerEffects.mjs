import { useCallback } from 'react';

import { deleteChatAttachmentUpload } from '../../utils/chatUploads.js';
import {
  focusGuildChatComposer,
  scrollGuildChatFeedToBottom,
  syncGuildChatComposerSelection,
  updateGuildChatStickToBottom,
} from './guildChatDockRuntime.mjs';
import { useGuildChatDockRuntimeEffects } from './useGuildChatDockRuntimeEffects.mjs';
import { revokeGuildChatPendingPreview } from './useGuildChatDockControllerUploadRuntime.mjs';

export function useGuildChatDockControllerEffects({
  guildChat,
  hidden = false,
  state = {},
  viewState = {},
} = {}) {
  const {
    emitTyping = () => {},
  } = guildChat || {};

  const {
    setComposerSelection = () => {},
    dragActive = false,
    setDragActive = () => {},
    typingActiveRef = { current: false },
    typingTimeoutRef = { current: null },
    feedRef = { current: null },
    inputRef = { current: null },
    stickToBottomRef = { current: true },
    dragDepthRef = { current: 0 },
    collapseScrollTimeoutRef = { current: null },
    previousHiddenRef = { current: hidden },
    previousFullscreenRef = { current: false },
    initialFocusAppliedRef = { current: false },
    pendingFilesRef = { current: [] },
  } = state;

  const {
    liveEntries = [],
    typingUsers = [],
  } = viewState;

  const focusComposerInput = useCallback(() => {
    focusGuildChatComposer({
      inputRef,
      setComposerSelectionFn: setComposerSelection,
      requestAnimationFrameFn: window.requestAnimationFrame,
    });
  }, [inputRef, setComposerSelection]);

  const syncComposerSelection = useCallback((eventOrInput) => {
    syncGuildChatComposerSelection({
      eventOrInput,
      inputRef,
      setComposerSelectionFn: setComposerSelection,
    });
  }, [inputRef, setComposerSelection]);

  const scrollFeedToBottom = useCallback(() => {
    scrollGuildChatFeedToBottom({
      feedRef,
      stickToBottomRef,
    });
  }, [feedRef, stickToBottomRef]);

  const clearTypingTimer = useCallback(() => {
    if (!typingTimeoutRef.current) return;
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
  }, [typingTimeoutRef]);

  const stopTyping = useCallback(() => {
    clearTypingTimer();
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    emitTyping(false);
  }, [clearTypingTimer, emitTyping, typingActiveRef]);

  const syncFullscreenLayout = useCallback((fullscreen, dockAligned) => {
    if (!feedRef.current || hidden) return;
    if (!(fullscreen && dockAligned)) return;
    scrollFeedToBottom();
  }, [feedRef, hidden, scrollFeedToBottom]);

  const syncFullscreenCollapse = useCallback((fullscreen) => {
    const wasFullscreen = previousFullscreenRef.current;
    previousFullscreenRef.current = fullscreen;
    if (collapseScrollTimeoutRef.current) {
      window.clearTimeout(collapseScrollTimeoutRef.current);
      collapseScrollTimeoutRef.current = null;
    }
    if (!feedRef.current || hidden) return;
    if (!wasFullscreen || fullscreen) return;
    scrollFeedToBottom();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollFeedToBottom();
      });
    });
    collapseScrollTimeoutRef.current = window.setTimeout(() => {
      scrollFeedToBottom();
      collapseScrollTimeoutRef.current = null;
    }, 280);
  }, [
    collapseScrollTimeoutRef,
    feedRef,
    hidden,
    previousFullscreenRef,
    scrollFeedToBottom,
  ]);

  useGuildChatDockRuntimeEffects({
    hidden,
    dragActive,
    dragDepthRef,
    setDragActiveFn: setDragActive,
    feedRef,
    stickToBottomRef,
    liveEntryCount: liveEntries.length,
    typingUserCount: typingUsers.length,
    scrollFeedToBottomFn: scrollFeedToBottom,
    stopTypingFn: stopTyping,
    collapseScrollTimeoutRef,
    pendingFilesRef,
    revokePendingPreviewFn: revokeGuildChatPendingPreview,
    deleteChatAttachmentUploadFn: deleteChatAttachmentUpload,
    previousHiddenRef,
    initialFocusAppliedRef,
    focusComposerInputFn: focusComposerInput,
    windowObject: window,
  });

  const handleFeedScroll = useCallback(() => {
    updateGuildChatStickToBottom({
      feedRef,
      stickToBottomRef,
    });
  }, [feedRef, stickToBottomRef]);

  return {
    focusComposerInput,
    syncComposerSelection,
    clearTypingTimer,
    stopTyping,
    syncFullscreenLayout,
    syncFullscreenCollapse,
    handleFeedScroll,
  };
}
