import { useEffect, useRef } from 'react';

export const AUTH_USER_UPDATED_EVENT = 'guild:auth-user-updated';
const AUTH_CHALLENGE_DEDUPE_WINDOW_MS = 5000;
export const NIP46_KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
export const NIP46_KEEPALIVE_TIMEOUT_MS = 8000;

function defaultProfileSyncErrorHandler(err) {
  console.warn('[Auth] Failed to sync Nostr profile:', err?.message || err);
}

function defaultInitialSecureStartupErrorHandler(err) {
  console.warn('[Auth] Initial secure startup failed:', err?.message || err);
}

export function withNip46KeepaliveTimeout(promise, timeoutMs, message, {
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeoutFn(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeoutFn(timeoutId);
  });
}

export function getProfileSyncSessionKey(user) {
  if (!user?.userId || !user?.npub || !user?.token) return null;
  return `${user.userId}:${user.token}`;
}

export function claimProfileSyncSession(profileSyncSessionRef, user) {
  if (!profileSyncSessionRef || typeof profileSyncSessionRef !== 'object') {
    return false;
  }

  const sessionKey = getProfileSyncSessionKey(user);
  if (!sessionKey) {
    profileSyncSessionRef.current = null;
    return false;
  }

  if (profileSyncSessionRef.current === sessionKey) {
    return false;
  }

  profileSyncSessionRef.current = sessionKey;
  return true;
}

export function dispatchAuthUserUpdated(user, eventTarget = typeof window !== 'undefined' ? window : null) {
  if (!user || !eventTarget?.dispatchEvent) return false;
  eventTarget.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT, {
    detail: user,
  }));
  return true;
}

export function registerSessionExpiredListener(clearLocalSession, eventTarget = typeof window !== 'undefined' ? window : null) {
  if (!eventTarget?.addEventListener || !eventTarget?.removeEventListener) {
    return () => {};
  }

  const onExpired = () => {
    clearLocalSession?.().catch?.(() => {});
  };

  eventTarget.addEventListener('session-expired', onExpired);
  return () => {
    eventTarget.removeEventListener('session-expired', onExpired);
  };
}

export function registerNostrAuthChallengeListener({
  eventTarget = typeof window !== 'undefined' ? window : null,
  getAuthChallengeEventNameFn = () => null,
  openExternalFn = (url) => globalThis.window?.electronAPI?.openExternal?.(url),
  nowFn = () => Date.now(),
} = {}) {
  if (!eventTarget?.addEventListener || !eventTarget?.removeEventListener) {
    return () => {};
  }

  const eventName = getAuthChallengeEventNameFn?.();
  if (!eventName) {
    return () => {};
  }

  let lastUrl = null;
  let lastOpenedAt = 0;

  const onAuthChallenge = (event) => {
    const url = event?.detail?.url;
    if (!url) return;

    const now = nowFn();
    if (url === lastUrl && (now - lastOpenedAt) < AUTH_CHALLENGE_DEDUPE_WINDOW_MS) {
      return;
    }

    lastUrl = url;
    lastOpenedAt = now;
    openExternalFn?.(url);
  };

  eventTarget.addEventListener(eventName, onAuthChallenge);
  return () => {
    eventTarget.removeEventListener(eventName, onAuthChallenge);
  };
}

export async function runNip46SessionKeepalive({
  getLoginModeFn = () => null,
  getSignerFn = () => null,
  reconnectSignerFn = async () => false,
  waitForNip46RelayCooldownFn = async () => {},
  reconnectOnFailure = false,
  pingTimeoutMs = NIP46_KEEPALIVE_TIMEOUT_MS,
  withTimeoutFn = withNip46KeepaliveTimeout,
} = {}) {
  if (getLoginModeFn?.() !== 'nip46') {
    return { attempted: false, ok: false, refreshed: false, reason: 'not_nip46' };
  }

  const pingSigner = async (signer, stage) => {
    if (!signer || typeof signer.ping !== 'function') {
      throw new Error('Signer unavailable for NIP-46 keepalive');
    }
    await Promise.resolve(waitForNip46RelayCooldownFn?.(stage));
    await withTimeoutFn(
      Promise.resolve(signer.ping()),
      pingTimeoutMs,
      'Timed out waiting for the signer to answer a keepalive ping.',
    );
  };

  try {
    await pingSigner(getSignerFn?.(), 'before_nip46_keepalive_ping');
    return { attempted: true, ok: true, refreshed: false };
  } catch (error) {
    if (!reconnectOnFailure) {
      return { attempted: true, ok: false, refreshed: false, error };
    }
  }

  let restored = false;
  try {
    restored = Boolean(await Promise.resolve(reconnectSignerFn?.()));
  } catch (error) {
    return { attempted: true, ok: false, refreshed: false, error };
  }

  if (!restored) {
    return { attempted: true, ok: false, refreshed: false };
  }

  try {
    await pingSigner(getSignerFn?.(), 'after_nip46_keepalive_reconnect');
    return { attempted: true, ok: true, refreshed: true };
  } catch (error) {
    return { attempted: true, ok: false, refreshed: true, error };
  }
}

export function registerNip46SessionKeepalive({
  user = null,
  eventTarget = typeof window !== 'undefined' ? window : null,
  documentObject = typeof document !== 'undefined' ? document : null,
  keepaliveFn = runNip46SessionKeepalive,
  getLoginModeFn = () => null,
  getSignerFn = () => null,
  reconnectSignerFn = async () => false,
  waitForNip46RelayCooldownFn = async () => {},
  intervalMs = NIP46_KEEPALIVE_INTERVAL_MS,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!user?.npub || !user?.token) {
    return () => {};
  }

  let disposed = false;
  let inFlight = false;

  const runKeepalive = async (reconnectOnFailure = false) => {
    if (disposed || inFlight) return;
    inFlight = true;
    try {
      await keepaliveFn({
        reconnectOnFailure,
        getLoginModeFn,
        getSignerFn,
        reconnectSignerFn,
        waitForNip46RelayCooldownFn,
      });
    } finally {
      inFlight = false;
    }
  };

  const intervalId = setIntervalFn(() => {
    void runKeepalive(false);
  }, intervalMs);

  const handleFocus = () => {
    void runKeepalive(true);
  };

  const handleVisibilityChange = () => {
    if (documentObject?.hidden) return;
    void runKeepalive(true);
  };

  eventTarget?.addEventListener?.('focus', handleFocus);
  documentObject?.addEventListener?.('visibilitychange', handleVisibilityChange);

  return () => {
    disposed = true;
    clearIntervalFn(intervalId);
    eventTarget?.removeEventListener?.('focus', handleFocus);
    documentObject?.removeEventListener?.('visibilitychange', handleVisibilityChange);
  };
}

export function useAuthRuntimeEffects({
  user,
  clearLocalSession,
  initializeSecureSession,
  syncNostrProfile,
  getAuthChallengeEventNameFn = () => null,
  getLoginModeFn = () => null,
  getSignerFn = () => null,
  reconnectSignerFn = async () => false,
  waitForNip46RelayCooldownFn = async () => {},
  documentObject = typeof document !== 'undefined' ? document : null,
  onProfileSyncError = defaultProfileSyncErrorHandler,
  onInitialSecureStartupError = defaultInitialSecureStartupErrorHandler,
  eventTarget = typeof window !== 'undefined' ? window : null,
}) {
  const profileSyncSessionRef = useRef(null);

  useEffect(() => registerSessionExpiredListener(clearLocalSession, eventTarget), [
    clearLocalSession,
    eventTarget,
  ]);

  useEffect(() => registerNostrAuthChallengeListener({
    eventTarget,
    getAuthChallengeEventNameFn,
  }), [
    eventTarget,
    getAuthChallengeEventNameFn,
  ]);

  useEffect(() => registerNip46SessionKeepalive({
    user,
    eventTarget,
    documentObject,
    getLoginModeFn,
    getSignerFn,
    reconnectSignerFn,
    waitForNip46RelayCooldownFn,
  }), [
    documentObject,
    eventTarget,
    getLoginModeFn,
    getSignerFn,
    reconnectSignerFn,
    waitForNip46RelayCooldownFn,
    user?.userId,
    user?.npub,
    user?.token,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (user?.npub && user?.token) {
      (async () => {
        const result = await initializeSecureSession(user);
        if (cancelled || result?.cancelled) return;
      })().catch((err) => {
        if (cancelled) return;
        onInitialSecureStartupError(err);
      });
    }
    return () => { cancelled = true; };
  }, [
    initializeSecureSession,
    onInitialSecureStartupError,
    user?.userId,
    user?.npub,
    user?.token,
  ]);

  useEffect(() => {
    if (!claimProfileSyncSession(profileSyncSessionRef, user)) {
      return;
    }

    syncNostrProfile().catch(onProfileSyncError);
  }, [onProfileSyncError, syncNostrProfile, user?.userId, user?.npub, user?.token]);

  useEffect(() => {
    dispatchAuthUserUpdated(user, eventTarget);
  }, [eventTarget, user?.userId, user?.username, user?.profilePicture, user?.avatarColor, user?.npub]);
}
