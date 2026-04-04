import { useEffect } from 'react';

import { endPerfTraceAfterNextPaint } from '../../utils/devPerf';

export function useChatViewOpenTraceEffect({
  openTraceId = null,
  loading = false,
  completedOpenTraceIdsRef,
  conversationType = null,
  messageCount = 0,
  hasError = false,
  endPerfTraceAfterNextPaintFn = endPerfTraceAfterNextPaint,
} = {}) {
  useEffect(() => {
    if (!openTraceId || loading) return;
    if (completedOpenTraceIdsRef.current.has(openTraceId)) return;

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaintFn(openTraceId, {
      status: 'ready',
      surface: 'chat-view',
      conversationType,
      messageCount,
      hasError,
    });
  }, [
    completedOpenTraceIdsRef,
    conversationType,
    endPerfTraceAfterNextPaintFn,
    hasError,
    loading,
    messageCount,
    openTraceId,
  ]);
}
