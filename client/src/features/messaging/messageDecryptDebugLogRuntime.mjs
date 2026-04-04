import { LANE_DIAGNOSTIC_EVENT_NAME } from '../../utils/laneDiagnostics.js';

export function buildMessageDecryptDebugLogPayload(entry = {}) {
  return {
    at: entry?.at || null,
    lane: entry?.lane || null,
    event: entry?.event || null,
    details: {
      messageId: entry?.details?.messageId || null,
      route: entry?.details?.route || null,
      roomId: entry?.details?.roomId || null,
      senderUserId: entry?.details?.senderUserId || null,
      dmPartnerId: entry?.details?.dmPartnerId || null,
      bucket: entry?.details?.bucket || null,
      recoverable: entry?.details?.recoverable,
      previousState: entry?.details?.previousState || null,
      recoveredVia: entry?.details?.recoveredVia || null,
      quiet: entry?.details?.quiet,
      reason: entry?.details?.reason || null,
    },
  };
}

export function installMessageDecryptDebugLogBridge({
  windowObj = null,
  laneEventName = LANE_DIAGNOSTIC_EVENT_NAME,
  debugScope = 'message-decrypt',
  buildPayloadFn = buildMessageDecryptDebugLogPayload,
} = {}) {
  if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};
  if (!windowObj?.electronAPI?.debugLog) return () => {};

  const handleLaneDiagnostic = (event) => {
    const entry = event?.detail;
    if (entry?.lane !== 'message-decrypt') return;

    try {
      windowObj.electronAPI.debugLog(debugScope, JSON.stringify(buildPayloadFn(entry)));
    } catch {}
  };

  windowObj.addEventListener(laneEventName, handleLaneDiagnostic);
  return () => {
    windowObj.removeEventListener(laneEventName, handleLaneDiagnostic);
  };
}
