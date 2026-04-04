import {
  isSecureStartupTimeoutError,
  SECURE_STARTUP_EVENT,
  SECURE_STARTUP_TIMEOUT_MESSAGE,
} from './secureStartupState.mjs';
import { isDeferredBundleAttestationError } from '../crypto/signalIdentityModel.mjs';

export { isDeferredBundleAttestationError } from '../crypto/signalIdentityModel.mjs';

export const SECURE_STARTUP_TIMEOUT_MS = 20000;
export const E2E_INIT_READY_EVENT = 'e2e-init-ready';

export function emitE2EInitFailed(error) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('e2e-init-failed', {
    detail: { error },
  }));
}

export function emitE2EInitReady() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(E2E_INIT_READY_EVENT));
}

export async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function initializeSecureSessionAttempt(authData, {
  attemptId,
  getCurrentAttemptId,
  shouldReconnect = false,
  reconnectSigner,
  initializeCryptoIdentity,
  getSigner,
  dispatchCryptoState,
  onInitFailed = emitE2EInitFailed,
  onInitReady = emitE2EInitReady,
} = {}) {
  const isCurrentAttempt = () => attemptId === getCurrentAttemptId?.();
  const failSecureStartup = (message) => {
    if (!isCurrentAttempt()) {
      return { ok: false, cancelled: true };
    }
    dispatchCryptoState?.({
      type: SECURE_STARTUP_EVENT.BLOCKED,
      error: message,
    });
    onInitFailed?.(message);
    return { ok: false, error: message };
  };

  dispatchCryptoState?.({ type: SECURE_STARTUP_EVENT.START });

  const shouldAttemptSignerRestore = typeof reconnectSigner === 'function'
    && (shouldReconnect || !getSigner?.());

  if (shouldAttemptSignerRestore) {
    try {
      const ok = await reconnectSigner?.();
      if (!ok && shouldReconnect) {
        return failSecureStartup('Nostr signer unavailable. Reconnect your signer to restore secure messaging.');
      }
    } catch (err) {
      if (shouldReconnect) {
        return failSecureStartup(err?.message || 'Failed to reconnect Nostr signer');
      }
    }
  }

  try {
    await initializeCryptoIdentity?.(authData, {
      allowDeferredBundleAttestation: !Boolean(getSigner?.()),
    });
    if (!isCurrentAttempt()) {
      return { ok: false, cancelled: true };
    }
    dispatchCryptoState?.({ type: SECURE_STARTUP_EVENT.READY });
    onInitReady?.();
    return { ok: true };
  } catch (err) {
    if (!isCurrentAttempt()) {
      return { ok: false, cancelled: true };
    }
    if (getSigner?.() && isDeferredBundleAttestationError(err)) {
      try {
        await initializeCryptoIdentity?.(authData, {
          allowDeferredBundleAttestation: true,
        });
        if (!isCurrentAttempt()) {
          return { ok: false, cancelled: true };
        }
        dispatchCryptoState?.({ type: SECURE_STARTUP_EVENT.READY });
        onInitReady?.();
        return { ok: true };
      } catch (retryErr) {
        if (!isCurrentAttempt()) {
          return { ok: false, cancelled: true };
        }
        return failSecureStartup(retryErr?.message || String(retryErr));
      }
    }
    return failSecureStartup(err?.message || String(err));
  }
}

export async function ensureCompletedSecureLogin(authData, {
  initializeSecureSession,
  dispatchCryptoState,
  pushTrace,
  redactTraceValue,
  summarizeError,
  onInitFailed = emitE2EInitFailed,
  timeoutMs = SECURE_STARTUP_TIMEOUT_MS,
} = {}) {
  pushTrace?.('secure_login.start', {
    npub: redactTraceValue?.(authData?.npub),
  });

  const secureStartupPromise = initializeSecureSession(authData);
  let result;
  try {
    result = await withTimeout(
      secureStartupPromise,
      timeoutMs,
      SECURE_STARTUP_TIMEOUT_MESSAGE,
    );
  } catch (err) {
    if (!isSecureStartupTimeoutError(err)) {
      throw err;
    }

    pushTrace?.('secure_login.timeout', {
      npub: redactTraceValue?.(authData?.npub),
      error: err?.message || SECURE_STARTUP_TIMEOUT_MESSAGE,
    }, 'warn');

    dispatchCryptoState?.({
      type: SECURE_STARTUP_EVENT.BACKGROUND,
      error: err?.message || SECURE_STARTUP_TIMEOUT_MESSAGE,
    });

    secureStartupPromise.then((backgroundResult) => {
      if (!backgroundResult || backgroundResult.cancelled) {
        return;
      }
      if (backgroundResult.ok) {
        dispatchCryptoState?.({ type: SECURE_STARTUP_EVENT.READY });
        pushTrace?.('secure_login.background_success', {
          npub: redactTraceValue?.(authData?.npub),
        });
        return;
      }

      const backgroundMessage = backgroundResult.error || 'Secure startup failed';
      dispatchCryptoState?.({
        type: SECURE_STARTUP_EVENT.BLOCKED,
        error: backgroundMessage,
      });
      onInitFailed?.(backgroundMessage);
      pushTrace?.('secure_login.background_error', {
        error: backgroundMessage,
      }, 'error');
    }).catch((backgroundErr) => {
      const backgroundMessage = backgroundErr?.message || String(backgroundErr);
      dispatchCryptoState?.({
        type: SECURE_STARTUP_EVENT.BLOCKED,
        error: backgroundMessage,
      });
      onInitFailed?.(backgroundMessage);
      pushTrace?.('secure_login.background_error', {
        error: summarizeError?.(backgroundErr) || backgroundMessage,
      }, 'error');
    });

    return;
  }

  if (!result.ok) {
    pushTrace?.('secure_login.error', {
      error: result.error || 'Secure startup failed',
    }, 'error');
    throw new Error(result.error || 'Secure startup failed');
  }

  pushTrace?.('secure_login.success', {
    npub: redactTraceValue?.(authData?.npub),
  });
}
