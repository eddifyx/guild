export function canReuseVoiceCaptureStream(previousCapture, {
  requestedInputId = '',
  forceFreshRawMicCapture = false,
} = {}) {
  const previousTrack = previousCapture?.stream?.getAudioTracks?.()?.[0] || null;
  return !forceFreshRawMicCapture && (
    previousCapture?.stream
    && previousTrack?.readyState === 'live'
    && (previousCapture.requestedInputId || '') === requestedInputId
    && (!requestedInputId || previousCapture.usedDefaultDeviceFallback !== true)
  );
}

export async function acquireVoiceCaptureStream({
  previousCapture = null,
  requestedInputId = '',
  forceFreshRawMicCapture = false,
  captureConstraintMode = null,
  noiseSuppressionEnabled = false,
  initialConstraints,
  fallbackConstraints,
  buildTrackConstraintPatchFn,
  mediaDevices = globalThis.navigator?.mediaDevices,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
  onReuseFailed = () => {},
  onSavedDeviceFailed = () => {},
} = {}) {
  let appliedConstraints = initialConstraints;
  let usedDefaultDeviceFallback = false;
  let reusedExistingStream = false;
  let getUserMediaMs = null;
  let stream = null;

  if (canReuseVoiceCaptureStream(previousCapture, {
    requestedInputId,
    forceFreshRawMicCapture,
  })) {
    const previousTrack = previousCapture?.stream?.getAudioTracks?.()?.[0] || null;
    try {
      await previousTrack?.applyConstraints?.(buildTrackConstraintPatchFn({
        mode: captureConstraintMode,
        noiseSuppressionEnabled,
      }));
      stream = previousCapture.stream;
      reusedExistingStream = true;
      getUserMediaMs = 0;
    } catch (error) {
      onReuseFailed(error);
    }
  }

  if (!stream) {
    try {
      const getUserMediaStart = nowFn();
      stream = await mediaDevices.getUserMedia(initialConstraints);
      getUserMediaMs = roundMsFn(nowFn() - getUserMediaStart);
    } catch (error) {
      onSavedDeviceFailed(error);
      usedDefaultDeviceFallback = true;
      appliedConstraints = fallbackConstraints;
      try {
        const getUserMediaStart = nowFn();
        stream = await mediaDevices.getUserMedia(fallbackConstraints);
        getUserMediaMs = roundMsFn(nowFn() - getUserMediaStart);
      } catch (fallbackError) {
        return {
          stream: null,
          appliedConstraints,
          usedDefaultDeviceFallback,
          reusedExistingStream,
          getUserMediaMs,
          error: fallbackError,
        };
      }
    }
  }

  return {
    stream,
    appliedConstraints,
    usedDefaultDeviceFallback,
    reusedExistingStream,
    getUserMediaMs,
    error: null,
  };
}
