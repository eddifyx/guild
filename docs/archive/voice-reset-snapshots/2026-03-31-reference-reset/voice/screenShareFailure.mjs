export async function buildScreenShareStartError(error, {
  sourceId = null,
  includeAudio = false,
  getPlatform = () => globalThis.window?.electronAPI?.getPlatform?.(),
  getScreenCaptureAccessStatus = () => globalThis.window?.electronAPI?.getScreenCaptureAccessStatus?.(),
} = {}) {
  const baseMessage = error?.message || 'Secure screen sharing could not start.';
  const platform = getPlatform();
  if (platform !== 'darwin') {
    return baseMessage;
  }

  let screenCaptureAccessStatus = 'unknown';
  try {
    screenCaptureAccessStatus = await getScreenCaptureAccessStatus?.() || 'unknown';
  } catch {}

  if (
    error?.name === 'NotReadableError'
    && typeof sourceId === 'string'
    && sourceId.startsWith('window:')
  ) {
    return includeAudio
      ? 'That macOS window could not be captured. Try “Entire screen” instead, and leave “Also share audio” off once so we can confirm the window source is the failing part.'
      : 'That macOS window could not be captured. Try “Entire screen” instead.';
  }

  const normalized = String(baseMessage).toLowerCase();
  const looksLikePermissionFailure =
    normalized.includes('screen recording')
    || normalized.includes('permission')
    || normalized.includes('not permitted')
    || normalized.includes('not authorized')
    || normalized.includes('access denied')
    || normalized.includes('system denied');
  const looksLikeCaptureStartFailure =
    normalized.includes('could not start media source')
    || normalized.includes('could not start video source')
    || normalized.includes('could not start video capture');

  if (screenCaptureAccessStatus === 'granted' && looksLikeCaptureStartFailure) {
    return typeof sourceId === 'string' && sourceId.startsWith('screen:')
      ? 'That macOS screen source could not be captured even though Screen Recording is already enabled. Fully quit /guild Staging and retry once. If it still fails, reopen the picker and choose “Entire screen” again.'
      : 'That macOS source could not be captured even though Screen Recording is already enabled. Try “Entire screen” instead.';
  }

  if (looksLikePermissionFailure || looksLikeCaptureStartFailure) {
    return 'Screen sharing could not start on macOS. Fully quit /guild and retry once. If it still fails, try a full-screen source and leave “Also share audio” off once to isolate whether the failure is in screen capture or audio capture.';
  }

  return baseMessage;
}

export function logScreenShareFailureContext({
  error,
  sourceId = null,
  includeAudio = false,
  hasMacAudioDevice = false,
}, {
  getPlatform = () => globalThis.window?.electronAPI?.getPlatform?.() || null,
  debugLog = (...args) => globalThis.window?.electronAPI?.debugLog?.(...args),
  consoleError = (...args) => globalThis.console?.error?.(...args),
} = {}) {
  const payload = {
    name: error?.name || null,
    message: error?.message || null,
    stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 6) : null,
    sourceId,
    includeAudio,
    hasMacAudioDevice,
    platform: getPlatform(),
  };

  try {
    consoleError(`[ScreenShareFailure] ${JSON.stringify(payload)}`);
  } catch {
    consoleError('[ScreenShareFailure] failed to serialize error payload');
  }

  try {
    debugLog('screen-share-failure', JSON.stringify(payload));
  } catch {}

  return payload;
}
