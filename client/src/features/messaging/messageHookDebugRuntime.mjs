export function createDebugRoomOpenLogger({
  windowObj = null,
} = {}) {
  return function debugRoomOpenLog(phase, details = {}) {
    if (!windowObj?.electronAPI?.debugLog) return;
    try {
      windowObj.electronAPI.debugLog('room-open', JSON.stringify({
        phase,
        at: Date.now(),
        ...details,
      }));
    } catch {}
  };
}
