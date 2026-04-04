import {
  getChatViewMediaReadyReleaseDelayMs,
  shouldKeepChatViewPinnedToBottom,
} from './chatViewRuntimeModel.mjs';

function isMediaNodeReady(node) {
  if (!node) return true;
  if (node.tagName === 'VIDEO') {
    return node.readyState >= 1;
  }
  return node.complete && node.naturalWidth > 0;
}

function getAnimationFrameFn(requestAnimationFrameFn) {
  if (typeof requestAnimationFrameFn === 'function') return requestAnimationFrameFn;
  return (callback) => callback();
}

export function bindChatViewScrollRuntime({
  scrollRef = { current: null },
  messagesContentRef = { current: null },
  wasAtBottomRef = { current: true },
  scrollingRef = { current: false },
  pendingInitialScrollRef = { current: false },
  initialScrollPinnedUntilRef = { current: 0 },
  scrollToBottomFn = () => {},
  scheduleInitialBottomReleaseFn = () => {},
  getMediaReadyReleaseDelayMsFn = getChatViewMediaReadyReleaseDelayMs,
  shouldKeepPinnedToBottomFn = shouldKeepChatViewPinnedToBottom,
  requestAnimationFrameFn = globalThis.requestAnimationFrame?.bind(globalThis),
  ResizeObserverCtor = globalThis.ResizeObserver,
  MutationObserverCtor = globalThis.MutationObserver,
  nowFn = Date.now,
} = {}) {
  const scroller = scrollRef?.current;
  const content = messagesContentRef?.current;
  if (!scroller || !content) return undefined;

  const requestFrame = getAnimationFrameFn(requestAnimationFrameFn);
  const cleanupMedia = [];
  let pendingMediaCount = 0;

  const clearMediaListeners = () => {
    while (cleanupMedia.length > 0) {
      cleanupMedia.pop()?.();
    }
  };

  const refreshInitialPinWindow = () => {
    if (!pendingInitialScrollRef.current) return;
    if (pendingMediaCount > 0) {
      scheduleInitialBottomReleaseFn(getMediaReadyReleaseDelayMsFn(pendingMediaCount));
      return;
    }
    scheduleInitialBottomReleaseFn(280);
  };

  const keepPinnedToBottom = () => {
    const shouldStick = shouldKeepPinnedToBottomFn({
      wasAtBottom: wasAtBottomRef.current,
      scrolling: scrollingRef.current,
      pendingInitialScroll: pendingInitialScrollRef.current,
      initialScrollPinnedUntil: initialScrollPinnedUntilRef.current,
      now: nowFn(),
    });

    if (!shouldStick) return;
    requestFrame(() => {
      if (scrollRef.current !== scroller) return;
      scrollToBottomFn();
    });

    if (pendingInitialScrollRef.current && pendingMediaCount === 0) {
      scheduleInitialBottomReleaseFn(280);
    }
  };

  const attachMediaListeners = () => {
    clearMediaListeners();
    pendingMediaCount = 0;

    const mediaNodes = Array.from(content.querySelectorAll('img,video'));
    for (const node of mediaNodes) {
      if (!isMediaNodeReady(node)) {
        pendingMediaCount += 1;
      }

      const eventName = node.tagName === 'VIDEO' ? 'loadedmetadata' : 'load';
      const handleMediaReady = () => {
        pendingMediaCount = Math.max(0, pendingMediaCount - 1);
        keepPinnedToBottom();
        refreshInitialPinWindow();
      };

      node.addEventListener(eventName, handleMediaReady);
      cleanupMedia.push(() => node.removeEventListener(eventName, handleMediaReady));
    }

    refreshInitialPinWindow();
  };

  if (typeof ResizeObserverCtor !== 'function') {
    attachMediaListeners();
    keepPinnedToBottom();
    return () => {
      clearMediaListeners();
    };
  }

  let mutationObserver = null;
  if (typeof MutationObserverCtor === 'function') {
    mutationObserver = new MutationObserverCtor(() => {
      attachMediaListeners();
      keepPinnedToBottom();
    });
    mutationObserver.observe(content, { childList: true, subtree: true });
  }

  attachMediaListeners();

  const observer = new ResizeObserverCtor(() => {
    keepPinnedToBottom();
  });
  observer.observe(content);
  keepPinnedToBottom();

  return () => {
    observer.disconnect();
    mutationObserver?.disconnect();
    clearMediaListeners();
  };
}
