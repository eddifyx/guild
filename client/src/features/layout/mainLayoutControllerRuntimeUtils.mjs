export function deriveMainLayoutLatestVersionState(info) {
  return {
    latestVersionInfo: info,
    updateAvailable: !!info?.hasUpdate,
  };
}

export function deriveMainLayoutConversationState({
  previousConversation = null,
  previousConversationName = '',
  nextConversation = null,
  nextConversationName = '',
  applyConversationStateFn = (_prev, nextValue) => nextValue,
  applyConversationNameFn = (_prev, nextValue) => nextValue,
} = {}) {
  return {
    conversation: applyConversationStateFn(previousConversation, nextConversation),
    conversationName: applyConversationNameFn(previousConversationName, nextConversationName),
  };
}

export function updateMainLayoutConversationPerfTrace({
  currentTraceId = null,
  nextTraceId = null,
  cancelPerfTraceFn = () => {},
} = {}) {
  if (currentTraceId && currentTraceId !== nextTraceId) {
    cancelPerfTraceFn(currentTraceId, {
      reason: 'superseded',
    });
  }

  return nextTraceId;
}

export function clearMainLayoutConversationPerfTrace({
  currentTraceId = null,
  reason = 'navigated-away',
  cancelPerfTraceFn = () => {},
} = {}) {
  if (currentTraceId) {
    cancelPerfTraceFn(currentTraceId, { reason });
  }

  return null;
}
