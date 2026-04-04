export function buildChatViewIdentityVerificationInput({
  effectiveConversation = null,
  trustedNpub = null,
  isE2EInitializedFn,
} = {}) {
  return {
    effectiveConversation,
    trustedNpub,
    isE2EInitializedFn,
  };
}

export function buildChatViewTrustActionInput({
  effectiveConversation = null,
  trustInput = '',
  setTrustSavingFn = () => {},
  setTrustErrorFn = () => {},
  setTrustedNpubFn = () => {},
  setTrustInputFn = () => {},
  lookupUserByNpubFn,
  trustUserNpubFn,
} = {}) {
  return {
    effectiveConversation,
    trustInput,
    setTrustSavingFn,
    setTrustErrorFn,
    setTrustedNpubFn,
    setTrustInputFn,
    lookupUserByNpubFn,
    trustUserNpubFn,
  };
}

export function buildChatViewScrollRuntimeInput({
  scrollRef,
  messagesContentRef,
  wasAtBottomRef,
  scrollingRef,
  pendingInitialScrollRef,
  initialScrollPinnedUntilRef,
  scrollToBottomFn = () => {},
  scheduleInitialBottomReleaseFn = () => {},
  getMediaReadyReleaseDelayMsFn,
  shouldKeepPinnedToBottomFn,
  requestAnimationFrameFn,
} = {}) {
  return {
    scrollRef,
    messagesContentRef,
    wasAtBottomRef,
    scrollingRef,
    pendingInitialScrollRef,
    initialScrollPinnedUntilRef,
    scrollToBottomFn,
    scheduleInitialBottomReleaseFn,
    getMediaReadyReleaseDelayMsFn,
    shouldKeepPinnedToBottomFn,
    requestAnimationFrameFn,
  };
}

export function buildChatViewScrollHandlerInput({
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
  return {
    scrollRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    hasMore,
    loading,
    loadMoreFn,
    releaseInitialBottomPinFn,
    requestAnimationFrameFn,
  };
}

export function buildChatViewSendHandlerInput({
  sendMessageFn = async () => {},
  wasAtBottomRef,
} = {}) {
  return {
    sendMessageFn,
    wasAtBottomRef,
  };
}

export function buildChatViewTrustUiHandlersInput({
  trustError = '',
  setTrustInputFn = () => {},
  setTrustErrorFn = () => {},
  setShowVerifyModalFn = () => {},
  setKeyChangedFn = () => {},
} = {}) {
  return {
    trustError,
    setTrustInputFn,
    setTrustErrorFn,
    setShowVerifyModalFn,
    setKeyChangedFn,
  };
}

export function buildChatViewRuntimeValue({
  effectiveConversation = null,
  dmUnavailable = false,
  messages = [],
  loading = false,
  hasMore = false,
  conversationError = '',
  editMessage,
  deleteMessage,
  bottomRef,
  scrollRef,
  messagesContentRef,
  keyChanged = false,
  identityCheckError = '',
  showVerifyModal = false,
  trustInput = '',
  trustError = '',
  trustSaving = false,
  dmTrustRequired = false,
  onScroll = () => {},
  onSend = async () => {},
  onTrustInputChange = () => {},
  onTrustContact = async () => false,
  onOpenVerifyModal = () => {},
  onCloseVerifyModal = () => {},
  onVerifiedIdentity = () => {},
} = {}) {
  return {
    effectiveConversation,
    dmUnavailable,
    messages,
    loading,
    hasMore,
    conversationError,
    editMessage,
    deleteMessage,
    bottomRef,
    scrollRef,
    messagesContentRef,
    keyChanged,
    identityCheckError,
    showVerifyModal,
    trustInput,
    trustError,
    trustSaving,
    dmTrustRequired,
    onScroll,
    onSend,
    onTrustInputChange,
    onTrustContact,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  };
}
