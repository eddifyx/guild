export function schedulePendingDecryptExpiry({
  messages,
  conversation,
  hasMore,
  userId,
  visibleTimeoutMs,
  getPendingDecryptVisibilityDelayFn,
  expirePendingDecryptMessagesFn,
  setMessagesFn,
  cacheConversationStateFn,
  windowObj,
  nowFn = Date.now,
} = {}) {
  const nextExpiryMs = getPendingDecryptVisibilityDelayFn?.({
    messages,
    conversation,
    userId,
    now: nowFn(),
    visibleTimeoutMs,
  });
  if (nextExpiryMs == null) return () => {};

  const setTimeoutFn = windowObj?.setTimeout?.bind(windowObj) || globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = windowObj?.clearTimeout?.bind(windowObj) || globalThis.clearTimeout.bind(globalThis);

  const timeoutId = setTimeoutFn(() => {
    setMessagesFn?.((previousMessages) => {
      const result = expirePendingDecryptMessagesFn?.({
        messages: previousMessages,
        conversation,
        userId,
        now: nowFn(),
        visibleTimeoutMs,
      });
      if (!result?.changed) return previousMessages;
      cacheConversationStateFn?.(conversation, result.messages, hasMore, userId);
      return result.messages;
    });
  }, nextExpiryMs);

  return () => clearTimeoutFn(timeoutId);
}
