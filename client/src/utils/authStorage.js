import { normalizeSessionUser } from '../features/auth/sessionUserState.mjs';

const AUTH_STORAGE_KEY = 'auth';
const RECOVERABLE_AUTH_CACHE_KEY = '__guildRecoverableAuthCache';

let cachedRecoverableAuth;

function isBrowserRuntime() {
  return typeof window !== 'undefined';
}

function canUseLocalStorage() {
  if (!isBrowserRuntime()) return false;
  try {
    return !!window.localStorage;
  } catch {
    return false;
  }
}

function isElectronRuntime() {
  return isBrowserRuntime() && !!window.electronAPI;
}

function writeGlobalRecoverableAuth(authData) {
  if (!isBrowserRuntime()) return;
  try {
    window[RECOVERABLE_AUTH_CACHE_KEY] = authData || null;
  } catch {}
}

function readLocalRecoverableAuth() {
  if (!canUseLocalStorage()) return null;
  try {
    return normalizeSessionUser(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

function writeLocalRecoverableAuth(authData) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

function clearLocalRecoverableAuth() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function persistDesktopRecoverableAuth(authData) {
  window.electronAPI?.authStateSet?.(authData)
    .then((persisted) => {
      if (!persisted) {
        console.warn('[AuthStorage] Protected desktop auth persistence is unavailable; this session will not survive restart.');
      }
    })
    .catch((err) => {
      console.warn('[AuthStorage] Failed to persist desktop auth state:', err?.message || err);
    });
}

export function getStoredAuthSync() {
  if (cachedRecoverableAuth !== undefined) {
    writeGlobalRecoverableAuth(cachedRecoverableAuth);
    return cachedRecoverableAuth;
  }

  if (isElectronRuntime()) {
    try {
      const electronAuth = normalizeSessionUser(window.electronAPI?.authStateGetSync?.());
      if (electronAuth) {
        cachedRecoverableAuth = electronAuth;
        writeGlobalRecoverableAuth(electronAuth);
        clearLocalRecoverableAuth();
        return electronAuth;
      }
    } catch {}
  }

  const localAuth = readLocalRecoverableAuth();
  if (!localAuth) {
    cachedRecoverableAuth = null;
    writeGlobalRecoverableAuth(null);
    return null;
  }

  cachedRecoverableAuth = localAuth;
  writeGlobalRecoverableAuth(localAuth);
  if (isElectronRuntime()) {
    clearLocalRecoverableAuth();
    persistDesktopRecoverableAuth(localAuth);
  }
  return localAuth;
}

export function loadRecoverableStoredAuth() {
  return getStoredAuthSync();
}

export function persistRecoverableAuth(authData) {
  const normalized = normalizeSessionUser(authData);
  if (!normalized) return false;

  cachedRecoverableAuth = normalized;
  writeGlobalRecoverableAuth(normalized);

  if (isElectronRuntime()) {
    clearLocalRecoverableAuth();
    persistDesktopRecoverableAuth(normalized);
    return true;
  }

  writeLocalRecoverableAuth(normalized);
  return true;
}

export function clearRecoverableAuth() {
  cachedRecoverableAuth = null;
  writeGlobalRecoverableAuth(null);
  clearLocalRecoverableAuth();
  if (!isElectronRuntime()) return;
  window.electronAPI?.authStateClear?.().catch?.((err) => {
    console.warn('[AuthStorage] Failed to clear desktop auth state:', err?.message || err);
  });
}

export function hasRecoverableStoredAuthSync() {
  return !!getStoredAuthSync()?.token;
}
