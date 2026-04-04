import { SECURE_STARTUP_EVENT } from './secureStartupState.mjs';

export function restoreInitialSessionUser({
  loadStoredAuth,
  pushTrace,
  redactTraceValue,
  getSigner,
} = {}) {
  const restoredAuth = loadStoredAuth?.() || null;
  if (!restoredAuth) {
    return null;
  }

  pushTrace?.('session.restore.auth', {
    npub: redactTraceValue?.(restoredAuth?.npub),
    loginMode: restoredAuth?.loginMode || null,
    signerAvailable: Boolean(getSigner?.()),
  });

  return restoredAuth;
}

export function applyMergedSessionUser({
  currentUser,
  updates,
  mergeSessionUser,
  persistAuth,
} = {}) {
  const nextUser = mergeSessionUser?.(currentUser, updates);
  if (!nextUser || nextUser === currentUser) {
    return currentUser;
  }

  persistAuth?.(nextUser);
  return nextUser;
}

export async function clearLocalSessionState({
  secureStartupAttemptRef,
  destroyCryptoState,
  resetLocalSignalState,
  currentUser,
  disconnectSigner,
  clearRecoverableAuth,
  setUser,
  dispatchCryptoState,
} = {}) {
  if (secureStartupAttemptRef && typeof secureStartupAttemptRef.current === 'number') {
    secureStartupAttemptRef.current += 1;
  }

  await destroyCryptoState?.().catch?.(() => {});
  await resetLocalSignalState?.(currentUser?.userId).catch?.(() => {});
  await disconnectSigner?.().catch?.(() => {});
  clearRecoverableAuth?.();
  setUser?.(null);
  dispatchCryptoState?.({ type: SECURE_STARTUP_EVENT.SIGNED_OUT });
}

export async function logoutSession({
  apiRequest,
  clearLocalSession,
} = {}) {
  try {
    await apiRequest?.('/api/auth/logout', { method: 'POST' });
  } catch {}

  await clearLocalSession?.();
}
