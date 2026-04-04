export function createChatViewScrollHandler({
  scrollRef,
  wasAtBottomRef,
  scrollingRef,
  pendingOlderLoadIdRef,
  loadingOlderRef,
  pendingInitialScrollRef,
  hasMore = false,
  loading = false,
  loadMoreFn = async () => {},
  releaseInitialBottomPinFn = () => {},
  requestAnimationFrameFn = (callback) => callback(),
} = {}) {
  return function handleChatViewScroll() {
    const el = scrollRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    const isNearTop = el.scrollTop < 50;
    wasAtBottomRef.current = isNearBottom;

    if (!isNearBottom && pendingInitialScrollRef.current) {
      releaseInitialBottomPinFn();
    }

    if (!isNearTop) {
      pendingOlderLoadIdRef.current += 1;
    }

    if (scrollingRef.current || loadingOlderRef.current) return;
    if (isNearTop && hasMore && !loading) {
      const prevHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;
      const shouldStickToTop = el.scrollTop <= 4;
      const activeLoadId = pendingOlderLoadIdRef.current + 1;
      pendingOlderLoadIdRef.current = activeLoadId;
      loadingOlderRef.current = true;

      loadMoreFn().then(() => {
        if (pendingOlderLoadIdRef.current !== activeLoadId) return;
        if (scrollRef.current !== el) return;
        if (el.scrollTop >= 50 || wasAtBottomRef.current) return;

        requestAnimationFrameFn(() => {
          if (pendingOlderLoadIdRef.current !== activeLoadId) return;
          if (scrollRef.current !== el) return;
          if (el.scrollTop >= 50 || wasAtBottomRef.current) return;
          if (shouldStickToTop) {
            el.scrollTop = 0;
            return;
          }
          el.scrollTop = el.scrollHeight - prevHeight + prevScrollTop;
        });
      }).finally(() => {
        loadingOlderRef.current = false;
      });
    }
  };
}

export function createChatViewSendHandler({
  sendMessageFn = async () => {},
  wasAtBottomRef,
} = {}) {
  return async function handleChatViewSend(content, attachments) {
    await sendMessageFn(content, attachments);
    wasAtBottomRef.current = true;
  };
}

export function createChatViewTrustUiHandlers({
  trustError = '',
  setTrustInputFn = () => {},
  setTrustErrorFn = () => {},
  setShowVerifyModalFn = () => {},
  setKeyChangedFn = () => {},
} = {}) {
  return {
    onTrustInputChange(value) {
      setTrustInputFn(value);
      if (trustError) setTrustErrorFn('');
    },
    onOpenVerifyModal() {
      setShowVerifyModalFn(true);
    },
    onCloseVerifyModal() {
      setShowVerifyModalFn(false);
    },
    onVerifiedIdentity() {
      setKeyChangedFn(false);
      setShowVerifyModalFn(false);
    },
  };
}
