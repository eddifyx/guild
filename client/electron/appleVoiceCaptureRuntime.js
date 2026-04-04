const {
  createAppleVoiceCaptureSupportRuntime,
} = require('./appleVoiceCaptureSupportRuntime');
const {
  createAppleVoiceCaptureStartRuntime,
} = require('./appleVoiceCaptureStartRuntime');

function createAppleVoiceCaptureRuntime({
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  clearAppleVoiceCaptureFirstFrameTimeout,
  clearTimeoutFn = clearTimeout,
  createAppleVoiceCaptureSessionState,
  ensureAppleVoiceHelperBinary,
  firstFrameTimeoutMs,
  isAppleVoiceCapturePlatformSupported,
  normalizeAppleVoiceCaptureOwnerId,
  prepareAppleVoiceCaptureSessionForStop,
  readAppleVoiceJsonLine,
  sendFrame,
  sendState,
  setTimeoutFn = setTimeout,
  shouldDisableAppleVoiceCaptureForMessage,
  spawn,
  state,
}) {
  const {
    emitState,
    isAppleVoiceCaptureSupported,
    markAppleVoiceCaptureUnavailable,
    primeAppleVoiceCapture,
    stopAppleVoiceCaptureSession,
  } = createAppleVoiceCaptureSupportRuntime({
    clearTimeoutFn,
    ensureAppleVoiceHelperBinary,
    isAppleVoiceCapturePlatformSupported,
    normalizeAppleVoiceCaptureOwnerId,
    prepareAppleVoiceCaptureSessionForStop,
    sendState,
    state,
  });
  const {
    startAppleVoiceCaptureSession,
  } = createAppleVoiceCaptureStartRuntime({
    appendAppleVoiceCaptureFrames,
    applyAppleVoiceCaptureReadyPayload,
    buildAppleVoiceCaptureEndedError,
    clearAppleVoiceCaptureFirstFrameTimeout,
    clearTimeoutFn,
    createAppleVoiceCaptureSessionState,
    emitState,
    ensureAppleVoiceHelperBinary,
    firstFrameTimeoutMs,
    isAppleVoiceCaptureSupported,
    markAppleVoiceCaptureUnavailable,
    normalizeAppleVoiceCaptureOwnerId,
    readAppleVoiceJsonLine,
    sendFrame,
    setTimeoutFn,
    shouldDisableAppleVoiceCaptureForMessage,
    spawn,
    state,
    stopAppleVoiceCaptureSession,
  });

  return {
    isAppleVoiceCaptureSupported,
    markAppleVoiceCaptureUnavailable,
    primeAppleVoiceCapture,
    startAppleVoiceCaptureSession,
    stopAppleVoiceCaptureSession,
  };
}

module.exports = {
  createAppleVoiceCaptureRuntime,
};
