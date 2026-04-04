function createAppleVoiceCaptureStartRuntime({
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  clearAppleVoiceCaptureFirstFrameTimeout,
  clearTimeoutFn = clearTimeout,
  createAppleVoiceCaptureSessionState,
  emitState,
  ensureAppleVoiceHelperBinary,
  firstFrameTimeoutMs,
  isAppleVoiceCaptureSupported,
  markAppleVoiceCaptureUnavailable,
  normalizeAppleVoiceCaptureOwnerId,
  readAppleVoiceJsonLine,
  sendFrame,
  setTimeoutFn = setTimeout,
  shouldDisableAppleVoiceCaptureForMessage,
  spawn,
  state,
  stopAppleVoiceCaptureSession,
}) {
  async function startAppleVoiceCaptureSession(ownerId = 'default') {
    if (!isAppleVoiceCaptureSupported()) {
      throw new Error(state.disabledReason || 'Apple voice processing is unavailable on this Mac.');
    }

    const normalizedOwnerId = normalizeAppleVoiceCaptureOwnerId(ownerId);
    state.owners.add(normalizedOwnerId);

    if (state.session?.ready && state.session.firstFrameReceived) {
      return state.session.metadata;
    }

    if (state.startPromise) {
      return state.startPromise.catch((error) => {
        state.owners.delete(normalizedOwnerId);
        throw error;
      });
    }

    stopAppleVoiceCaptureSession(null, { force: true });
    state.owners.add(normalizedOwnerId);

    const helperBinary = await ensureAppleVoiceHelperBinary();
    const proc = spawn(helperBinary, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const sessionState = createAppleVoiceCaptureSessionState(proc);
    state.session = sessionState;

    state.startPromise = new Promise((resolve, reject) => {
      let settled = false;
      let stderrBuffer = '';

      const resolveOnce = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      proc.stdout.on('data', (chunk) => {
        if (!sessionState.ready || sessionState.frameBytes <= 0 || state.session !== sessionState) {
          return;
        }

        appendAppleVoiceCaptureFrames(sessionState, chunk, {
          clearTimeoutFn,
          onFirstFrame: () => resolveOnce(sessionState.metadata),
          onFrame: (frame) => {
            if (typeof sendFrame === 'function') {
              sendFrame(frame);
            }
          },
        });
      });

      proc.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString();
        let newlineIndex = stderrBuffer.indexOf('\n');

        while (newlineIndex !== -1) {
          const line = stderrBuffer.slice(0, newlineIndex).trim();
          stderrBuffer = stderrBuffer.slice(newlineIndex + 1);

          if (line) {
            const payload = readAppleVoiceJsonLine(line);
            if (payload?.type === 'ready') {
              applyAppleVoiceCaptureReadyPayload(sessionState, payload);
              clearAppleVoiceCaptureFirstFrameTimeout(sessionState, { clearTimeoutFn });
              sessionState.firstFrameTimeout = setTimeoutFn(() => {
                if (
                  settled
                  || sessionState.stopping
                  || sessionState.firstFrameReceived
                  || state.session !== sessionState
                ) {
                  return;
                }

                const error = new Error('Mac voice cleanup was ready but microphone audio never arrived.');
                emitState({
                  type: 'error',
                  message: error.message,
                });
                stopAppleVoiceCaptureSession(null, { force: true });
                rejectOnce(error);
              }, firstFrameTimeoutMs);
              sessionState.firstFrameTimeout.unref?.();
              emitState({
                type: 'ready',
                ...sessionState.metadata,
              });
            } else if (payload?.type === 'error' || payload?.type === 'fatal') {
              const message = payload.message || 'Apple voice processing failed.';
              if (payload.type === 'fatal' && shouldDisableAppleVoiceCaptureForMessage(message)) {
                markAppleVoiceCaptureUnavailable(message);
              }
              if (payload.type === 'fatal' && !settled) {
                rejectOnce(new Error(message));
              } else {
                emitState({
                  type: 'error',
                  message,
                });
              }
            }
          }

          newlineIndex = stderrBuffer.indexOf('\n');
        }
      });

      proc.on('error', (error) => {
        clearAppleVoiceCaptureFirstFrameTimeout(sessionState, { clearTimeoutFn });
        if (state.session === sessionState) {
          state.session = null;
          state.owners.clear();
        }
        rejectOnce(error);
      });

      proc.on('close', (code, signal) => {
        clearAppleVoiceCaptureFirstFrameTimeout(sessionState, { clearTimeoutFn });
        const wasActiveSession = state.session === sessionState;
        if (wasActiveSession) {
          state.session = null;
          state.owners.clear();
        }

        if (sessionState.stopping) {
          emitState({ type: 'stopped' });
          resolveOnce(sessionState.metadata || null);
          return;
        }

        const error = buildAppleVoiceCaptureEndedError(stderrBuffer, code, signal);
        if (!sessionState.stopping && shouldDisableAppleVoiceCaptureForMessage(error.message)) {
          markAppleVoiceCaptureUnavailable(error.message);
        }
        emitState({
          type: 'ended',
          code,
          signal,
          message: error.message,
        });
        rejectOnce(error);
      });
    });

    return state.startPromise
      .finally(() => {
        if (state.startPromise) {
          state.startPromise = null;
        }
      })
      .catch((error) => {
        state.owners.delete(normalizedOwnerId);
        throw error;
      });
  }

  return {
    startAppleVoiceCaptureSession,
  };
}

module.exports = {
  createAppleVoiceCaptureStartRuntime,
};
