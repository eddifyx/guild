import { useEffect } from 'react';

import { installMessageDecryptDebugLogBridge } from './messageDecryptDebugLogRuntime.mjs';

export function useMessagesDecryptDebugLogEffect({
  windowObj = null,
  installMessageDecryptDebugLogBridgeFn = installMessageDecryptDebugLogBridge,
} = {}) {
  useEffect(() => installMessageDecryptDebugLogBridgeFn({
    windowObj,
  }), [windowObj, installMessageDecryptDebugLogBridgeFn]);
}
