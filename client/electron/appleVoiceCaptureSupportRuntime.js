function createAppleVoiceCaptureSupportRuntime({
  clearTimeoutFn = clearTimeout,
  setTimeoutFn = setTimeout,
  ensureAppleVoiceHelperBinary,
  forceKillDelayMs = 1500,
  isAppleVoiceCapturePlatformSupported,
  normalizeAppleVoiceCaptureOwnerId,
  prepareAppleVoiceCaptureSessionForStop,
  sendState,
  state,
}) {
  function emitState(payload) {
    if (typeof sendState === 'function') {
      sendState(payload);
    }
  }

  function markAppleVoiceCaptureUnavailable(message) {
    if (!message || state.disabledReason) {
      return;
    }

    state.disabledReason = message;
    emitState({
      type: 'unavailable',
      message,
    });
  }

  function isAppleVoiceCaptureSupported() {
    return isAppleVoiceCapturePlatformSupported() && !state.disabledReason;
  }

  async function primeAppleVoiceCapture() {
    if (!isAppleVoiceCapturePlatformSupported()) {
      return { supported: false };
    }

    const binaryPath = await ensureAppleVoiceHelperBinary();
    return {
      supported: isAppleVoiceCaptureSupported(),
      binaryPath,
      disabledReason: state.disabledReason,
    };
  }

  function stopAppleVoiceCaptureSession(ownerId = null, { force = false } = {}) {
    if (force) {
      state.owners.clear();
    } else if (ownerId !== null) {
      state.owners.delete(normalizeAppleVoiceCaptureOwnerId(ownerId));
    } else {
      state.owners.clear();
    }

    if (state.owners.size > 0) {
      return false;
    }

    const sessionState = state.session;
    state.startPromise = null;
    if (!sessionState) {
      return false;
    }

    state.session = null;
    prepareAppleVoiceCaptureSessionForStop(sessionState, { clearTimeoutFn });

    try {
      sessionState.proc.stdout.removeAllListeners('data');
      sessionState.proc.stderr.removeAllListeners('data');
    } catch {}

    let forceKillTimeout = null;
    const clearForceKillTimeout = () => {
      if (forceKillTimeout) {
        clearTimeoutFn(forceKillTimeout);
        forceKillTimeout = null;
      }
    };

    try {
      sessionState.proc.once('close', clearForceKillTimeout);
      sessionState.proc.once('exit', clearForceKillTimeout);
    } catch {}

    try {
      sessionState.proc.kill('SIGTERM');
    } catch {}

    forceKillTimeout = setTimeoutFn(() => {
      try {
        sessionState.proc.kill('SIGKILL');
      } catch {}
    }, forceKillDelayMs);
    forceKillTimeout.unref?.();

    return true;
  }

  return {
    emitState,
    isAppleVoiceCaptureSupported,
    markAppleVoiceCaptureUnavailable,
    primeAppleVoiceCapture,
    stopAppleVoiceCaptureSession,
  };
}

module.exports = {
  createAppleVoiceCaptureSupportRuntime,
};
