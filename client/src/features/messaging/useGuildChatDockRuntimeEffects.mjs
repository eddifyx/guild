import { useEffect } from 'react';

import {
  cleanupGuildChatPendingUploads,
  resetGuildChatDragStateWhenHidden,
} from './guildChatDockRuntime.mjs';

export function useGuildChatDockRuntimeEffects({
  hidden = false,
  dragActive = false,
  dragDepthRef = { current: 0 },
  setDragActiveFn = () => {},
  feedRef = { current: null },
  stickToBottomRef = { current: true },
  liveEntryCount = 0,
  typingUserCount = 0,
  scrollFeedToBottomFn = () => {},
  stopTypingFn = () => {},
  collapseScrollTimeoutRef = { current: null },
  pendingFilesRef = { current: [] },
  revokePendingPreviewFn = () => {},
  deleteChatAttachmentUploadFn = async () => {},
  previousHiddenRef = { current: false },
  initialFocusAppliedRef = { current: false },
  focusComposerInputFn = () => {},
  windowObject = window,
} = {}) {
  useEffect(() => () => {
    stopTypingFn();
    if (collapseScrollTimeoutRef.current) {
      windowObject.clearTimeout(collapseScrollTimeoutRef.current);
      collapseScrollTimeoutRef.current = null;
    }
    cleanupGuildChatPendingUploads({
      pendingFilesRef,
      revokePendingPreviewFn,
      deleteChatAttachmentUploadFn,
    });
  }, [
    collapseScrollTimeoutRef,
    deleteChatAttachmentUploadFn,
    pendingFilesRef,
    revokePendingPreviewFn,
    stopTypingFn,
    windowObject,
  ]);

  useEffect(() => {
    resetGuildChatDragStateWhenHidden({
      hidden,
      dragActive,
      dragDepthRef,
      setDragActiveFn,
    });
  }, [dragActive, dragDepthRef, hidden, setDragActiveFn]);

  useEffect(() => {
    if (!feedRef.current || !stickToBottomRef.current) return;
    scrollFeedToBottomFn();
  }, [feedRef, liveEntryCount, scrollFeedToBottomFn, stickToBottomRef, typingUserCount]);

  useEffect(() => {
    const wasHidden = previousHiddenRef.current;
    previousHiddenRef.current = hidden;
    if (hidden || !wasHidden) return;
    focusComposerInputFn();
  }, [focusComposerInputFn, hidden, previousHiddenRef]);

  useEffect(() => {
    if (hidden || initialFocusAppliedRef.current) return;
    initialFocusAppliedRef.current = true;
    focusComposerInputFn();
  }, [focusComposerInputFn, hidden, initialFocusAppliedRef]);

  useEffect(() => {
    const handleFocusRequest = () => {
      if (hidden) return;
      focusComposerInputFn();
    };

    windowObject.addEventListener('guildchat:focus-composer', handleFocusRequest);
    return () => windowObject.removeEventListener('guildchat:focus-composer', handleFocusRequest);
  }, [focusComposerInputFn, hidden, windowObject]);
}
