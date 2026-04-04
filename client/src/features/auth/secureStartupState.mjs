export const CRYPTO_STATUS = Object.freeze({
  SIGNED_OUT: 'signed_out',
  BOOTING: 'booting',
  BACKGROUND: 'background',
  READY: 'ready',
  BLOCKED: 'blocked',
});

export const SECURITY_STATE = Object.freeze({
  SIGNED_OUT: 'signed_out',
  BOOTING: 'booting',
  BLOCKED: 'blocked',
  CRYPTO_READY: 'crypto_ready',
});

export const SECURE_STARTUP_EVENT = Object.freeze({
  SIGNED_OUT: 'SIGNED_OUT',
  START: 'START',
  READY: 'READY',
  BACKGROUND: 'BACKGROUND',
  BLOCKED: 'BLOCKED',
});

export const SECURE_STARTUP_TIMEOUT_MESSAGE = 'Login succeeded, but secure messaging setup did not finish in time.';

function normalizeMessage(message, fallback = null) {
  const normalized = String(message?.message || message || '').trim();
  return normalized || fallback;
}

export function createSecureStartupState({ hasStoredAuth = false } = {}) {
  return {
    status: hasStoredAuth ? CRYPTO_STATUS.BOOTING : CRYPTO_STATUS.SIGNED_OUT,
    error: null,
  };
}

export function reduceSecureStartupState(state, event = {}) {
  switch (event.type) {
    case SECURE_STARTUP_EVENT.SIGNED_OUT:
      return {
        status: CRYPTO_STATUS.SIGNED_OUT,
        error: null,
      };
    case SECURE_STARTUP_EVENT.START:
      return {
        status: CRYPTO_STATUS.BOOTING,
        error: null,
      };
    case SECURE_STARTUP_EVENT.READY:
      return {
        status: CRYPTO_STATUS.READY,
        error: null,
      };
    case SECURE_STARTUP_EVENT.BACKGROUND:
      return {
        status: CRYPTO_STATUS.BACKGROUND,
        error: normalizeMessage(event.error, SECURE_STARTUP_TIMEOUT_MESSAGE),
      };
    case SECURE_STARTUP_EVENT.BLOCKED:
      return {
        status: CRYPTO_STATUS.BLOCKED,
        error: normalizeMessage(event.error, 'Secure startup failed'),
      };
    default:
      return state;
  }
}

export function deriveSecurityState({ user, cryptoStatus }) {
  if (!user) return SECURITY_STATE.SIGNED_OUT;
  if (cryptoStatus === CRYPTO_STATUS.READY || cryptoStatus === CRYPTO_STATUS.BACKGROUND) {
    return SECURITY_STATE.CRYPTO_READY;
  }
  if (cryptoStatus === CRYPTO_STATUS.BLOCKED) {
    return SECURITY_STATE.BLOCKED;
  }
  return SECURITY_STATE.BOOTING;
}

export function isSecureStartupTimeoutError(error) {
  return normalizeMessage(error) === SECURE_STARTUP_TIMEOUT_MESSAGE;
}
