export function getChatViewTrustBootstrapState(effectiveConversation, getKnownNpubFn) {
  const trustedNpub = effectiveConversation?.type === 'dm'
    ? getKnownNpubFn?.(effectiveConversation.id) || null
    : null;

  return {
    keyChanged: false,
    identityCheckError: '',
    trustedNpub,
    trustInput: trustedNpub || '',
    trustError: '',
  };
}

export function shouldLoadChatViewIdentityVerification({
  effectiveConversation,
  trustedNpub,
  isE2EInitializedFn,
}) {
  return Boolean(
    effectiveConversation
    && effectiveConversation.type === 'dm'
    && !effectiveConversation.dmUnsupported
    && isE2EInitializedFn()
    && trustedNpub,
  );
}

export function getChatViewMediaReadyReleaseDelayMs(pendingMediaCount) {
  if (pendingMediaCount > 0) {
    return Math.min(2600, 1200 + (pendingMediaCount * 250));
  }
  return 280;
}

export function shouldKeepChatViewPinnedToBottom({
  wasAtBottom,
  scrolling,
  pendingInitialScroll,
  initialScrollPinnedUntil,
  now = Date.now(),
}) {
  return !scrolling && (
    wasAtBottom
    || pendingInitialScroll
    || now < initialScrollPinnedUntil
  );
}
