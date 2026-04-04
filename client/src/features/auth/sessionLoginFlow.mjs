export function stageAuthenticatedSession(authData, {
  persistAuth,
  resetSessionExpiry,
} = {}) {
  if (typeof persistAuth === 'function') {
    persistAuth(authData);
  }
  if (typeof resetSessionExpiry === 'function') {
    resetSessionExpiry();
  }
  return authData;
}

export async function finalizeAuthenticatedLogin(authData, {
  stageSession,
  ensureSecureLogin,
  setUser,
} = {}) {
  const nextAuthData = typeof stageSession === 'function'
    ? stageSession(authData)
    : authData;

  if (typeof ensureSecureLogin === 'function') {
    await ensureSecureLogin(nextAuthData);
  }

  if (typeof setUser === 'function') {
    setUser(nextAuthData);
  }

  return nextAuthData;
}
