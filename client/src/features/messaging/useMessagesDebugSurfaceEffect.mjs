import { useEffect } from 'react';

import {
  buildActiveConversationDecryptSnapshot,
  installMessageDecryptDebugSurface,
} from './messageDecryptDiagnosticsRuntime.mjs';

export function useMessagesDebugSurfaceEffect({
  conversation = null,
  userId = null,
  messages = [],
  windowObj = null,
  buildActiveConversationDecryptSnapshotFn = buildActiveConversationDecryptSnapshot,
  installMessageDecryptDebugSurfaceFn = installMessageDecryptDebugSurface,
} = {}) {
  useEffect(() => installMessageDecryptDebugSurfaceFn({
    windowObj,
    getActiveConversationDecryptSnapshotFn: () => buildActiveConversationDecryptSnapshotFn({
      conversation,
      userId,
      messages,
    }),
  }), [
    conversation,
    userId,
    messages,
    windowObj,
    buildActiveConversationDecryptSnapshotFn,
    installMessageDecryptDebugSurfaceFn,
  ]);
}
