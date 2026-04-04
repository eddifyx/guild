import { useCallback, useEffect } from 'react';

import {
  buildChatViewScrollHandlerInput,
  buildChatViewScrollRuntimeInput,
} from './chatViewRuntimeInputs.mjs';
import { createChatViewScrollHandler } from './chatViewRuntimeHandlers.mjs';
import {
  getChatViewMediaReadyReleaseDelayMs,
  shouldKeepChatViewPinnedToBottom,
} from './chatViewRuntimeModel.mjs';
import { bindChatViewScrollRuntime } from './chatViewScrollRuntime.mjs';

export function useChatViewScrollController({
  conversation,
  messagesLength = 0,
  scrollRef,
  messagesContentRef,
  wasAtBottomRef,
  scrollingRef,
  pendingOlderLoadIdRef,
  loadingOlderRef,
  pendingInitialScrollRef,
  initialScrollReleaseTimerRef,
  initialScrollPinnedUntilRef,
  hasMore = false,
  loading = false,
  loadMoreFn,
} = {}) {
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  const clearInitialBottomRelease = useCallback(() => {
    if (initialScrollReleaseTimerRef.current) {
      window.clearTimeout(initialScrollReleaseTimerRef.current);
      initialScrollReleaseTimerRef.current = null;
    }
  }, [initialScrollReleaseTimerRef]);

  const releaseInitialBottomPin = useCallback(() => {
    pendingInitialScrollRef.current = false;
    initialScrollPinnedUntilRef.current = 0;
    clearInitialBottomRelease();
  }, [
    clearInitialBottomRelease,
    initialScrollPinnedUntilRef,
    pendingInitialScrollRef,
  ]);

  const scheduleInitialBottomRelease = useCallback((delayMs = 220) => {
    if (!pendingInitialScrollRef.current) return;
    initialScrollPinnedUntilRef.current = Date.now() + Math.max(delayMs, 350);
    clearInitialBottomRelease();
    initialScrollReleaseTimerRef.current = window.setTimeout(() => {
      releaseInitialBottomPin();
    }, delayMs);
  }, [
    clearInitialBottomRelease,
    initialScrollPinnedUntilRef,
    initialScrollReleaseTimerRef,
    pendingInitialScrollRef,
    releaseInitialBottomPin,
  ]);

  useEffect(() => {
    if (!conversation) return;
    wasAtBottomRef.current = true;
    pendingOlderLoadIdRef.current += 1;
    loadingOlderRef.current = false;
    pendingInitialScrollRef.current = true;
    initialScrollPinnedUntilRef.current = Date.now() + 2200;
    scheduleInitialBottomRelease(2200);
    const frameId = requestAnimationFrame(() => {
      if (wasAtBottomRef.current) {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [
    conversation,
    initialScrollPinnedUntilRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    pendingOlderLoadIdRef,
    scheduleInitialBottomRelease,
    scrollToBottom,
    wasAtBottomRef,
  ]);

  useEffect(() => {
    if (messagesLength === 0 || !wasAtBottomRef.current || scrollingRef.current) return;
    const frameId = requestAnimationFrame(() => {
      if (wasAtBottomRef.current && !scrollingRef.current) {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [messagesLength, scrollToBottom, scrollingRef, wasAtBottomRef]);

  useEffect(() => {
    if (!conversation || !pendingInitialScrollRef.current) return;
    const frameId = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(frameId);
  }, [conversation, messagesLength, pendingInitialScrollRef, scrollToBottom]);

  useEffect(() => bindChatViewScrollRuntime(buildChatViewScrollRuntimeInput({
    scrollRef,
    messagesContentRef,
    wasAtBottomRef,
    scrollingRef,
    pendingInitialScrollRef,
    initialScrollPinnedUntilRef,
    scrollToBottomFn: scrollToBottom,
    scheduleInitialBottomReleaseFn: scheduleInitialBottomRelease,
    getMediaReadyReleaseDelayMsFn: getChatViewMediaReadyReleaseDelayMs,
    shouldKeepPinnedToBottomFn: shouldKeepChatViewPinnedToBottom,
    requestAnimationFrameFn: requestAnimationFrame,
  })), [
    conversation,
    initialScrollPinnedUntilRef,
    messagesContentRef,
    messagesLength,
    pendingInitialScrollRef,
    scheduleInitialBottomRelease,
    scrollRef,
    scrollToBottom,
    scrollingRef,
    wasAtBottomRef,
  ]);

  useEffect(() => () => {
    clearInitialBottomRelease();
  }, [clearInitialBottomRelease]);

  return useCallback(createChatViewScrollHandler(buildChatViewScrollHandlerInput({
    scrollRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    hasMore,
    loading,
    loadMoreFn,
    releaseInitialBottomPinFn: releaseInitialBottomPin,
    requestAnimationFrameFn: requestAnimationFrame,
  })), [
    hasMore,
    loading,
    loadingOlderRef,
    loadMoreFn,
    pendingInitialScrollRef,
    pendingOlderLoadIdRef,
    releaseInitialBottomPin,
    scrollRef,
    scrollingRef,
    wasAtBottomRef,
  ]);
}
