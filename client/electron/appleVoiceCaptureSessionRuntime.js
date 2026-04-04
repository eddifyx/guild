function readAppleVoiceJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function createAppleVoiceCaptureSessionState(proc) {
  return {
    proc,
    ready: false,
    stopping: false,
    metadata: null,
    stdoutBuffer: Buffer.alloc(0),
    frameBytes: 0,
    firstFrameReceived: false,
    firstFrameTimeout: null,
  };
}

function clearAppleVoiceCaptureFirstFrameTimeout(
  sessionState,
  { clearTimeoutFn = clearTimeout } = {}
) {
  if (!sessionState?.firstFrameTimeout) {
    return false;
  }

  clearTimeoutFn(sessionState.firstFrameTimeout);
  sessionState.firstFrameTimeout = null;
  return true;
}

function prepareAppleVoiceCaptureSessionForStop(
  sessionState,
  { clearTimeoutFn = clearTimeout } = {}
) {
  if (!sessionState) {
    return null;
  }

  sessionState.stopping = true;
  sessionState.stdoutBuffer = Buffer.alloc(0);
  clearAppleVoiceCaptureFirstFrameTimeout(sessionState, { clearTimeoutFn });
  return sessionState;
}

function buildAppleVoiceCaptureReadyMetadata(payload = {}) {
  return {
    backend: 'apple-voice-processing',
    sampleRate: payload.sampleRate || 48000,
    channels: payload.channels || 1,
    frameSamples: payload.frameSamples || 960,
    voiceProcessingEnabled: payload.voiceProcessingEnabled !== false,
    advancedOtherAudioDucking: payload.advancedOtherAudioDucking === true,
    otherAudioDuckingLevel: Number.isFinite(payload.otherAudioDuckingLevel)
      ? payload.otherAudioDuckingLevel
      : null,
    inputSampleRate: payload.inputSampleRate || null,
    inputChannels: payload.inputChannels || null,
    configuration: payload.configuration || null,
  };
}

function applyAppleVoiceCaptureReadyPayload(sessionState, payload) {
  sessionState.ready = true;
  sessionState.metadata = buildAppleVoiceCaptureReadyMetadata(payload);
  sessionState.frameBytes = sessionState.metadata.frameSamples * 2 * sessionState.metadata.channels;
  return sessionState.metadata;
}

function appendAppleVoiceCaptureFrames(
  sessionState,
  chunk,
  {
    clearTimeoutFn = clearTimeout,
    onFirstFrame = () => {},
    onFrame = () => {},
  } = {}
) {
  if (!sessionState?.ready || sessionState.frameBytes <= 0) {
    return 0;
  }

  sessionState.stdoutBuffer = Buffer.concat([sessionState.stdoutBuffer, chunk]);
  let emitted = 0;

  while (sessionState.stdoutBuffer.length >= sessionState.frameBytes) {
    const frame = sessionState.stdoutBuffer.subarray(0, sessionState.frameBytes);
    sessionState.stdoutBuffer = sessionState.stdoutBuffer.subarray(sessionState.frameBytes);

    if (!sessionState.firstFrameReceived) {
      sessionState.firstFrameReceived = true;
      clearAppleVoiceCaptureFirstFrameTimeout(sessionState, { clearTimeoutFn });
      onFirstFrame(sessionState.metadata);
    }

    onFrame(frame);
    emitted += 1;
  }

  return emitted;
}

function buildAppleVoiceCaptureEndedError(stderrBuffer, code, signal) {
  return new Error(
    String(stderrBuffer || '').trim()
      || `Apple voice processing exited unexpectedly (${signal || code || 'unknown'}).`
  );
}

module.exports = {
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  buildAppleVoiceCaptureReadyMetadata,
  clearAppleVoiceCaptureFirstFrameTimeout,
  createAppleVoiceCaptureSessionState,
  prepareAppleVoiceCaptureSessionForStop,
  readAppleVoiceJsonLine,
};
