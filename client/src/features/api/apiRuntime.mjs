import {
  buildAuthenticatedFileUrl,
  buildServerConnectionError,
  isInsecureServerUrl,
  migrateKnownServerUrl,
  normalizeConfiguredServerUrl,
  normalizeServerUrl,
  parseServerUrlList,
} from './serverUrlModel.mjs';

const DEFAULT_CANONICAL_SERVER_URL = 'https://prod.82.221.100.187.sslip.io';
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const CANONICAL_SERVER_URL = normalizeServerUrl(env.VITE_CANONICAL_SERVER_URL) || DEFAULT_CANONICAL_SERVER_URL;
const KNOWN_LEGACY_SERVER_URLS = new Set([
  'http://82.221.100.187',
  'http://82.221.100.187:80',
  'http://82.221.100.187:3001',
  'http://prod.82.221.100.187.sslip.io',
  'http://prod.82.221.100.187.sslip.io:80',
  'http://prod.82.221.100.187.sslip.io:3001',
  ...parseServerUrlList(env.VITE_LEGACY_SERVER_URLS),
].map(normalizeServerUrl));

function migrateKnownProductionServerUrl(rawUrl) {
  return migrateKnownServerUrl(rawUrl, {
    canonicalServerUrl: CANONICAL_SERVER_URL,
    knownLegacyServerUrls: KNOWN_LEGACY_SERVER_URLS,
  });
}

const ENV_DEFAULT_SERVER_URL = migrateKnownProductionServerUrl(env.VITE_DEFAULT_SERVER_URL || '');
const PACKAGED_DEFAULT_SERVER_URL = ENV_DEFAULT_SERVER_URL || CANONICAL_SERVER_URL;
const DEV_DEFAULT_SERVER_URL = 'http://localhost:3001';
const RECOVERABLE_AUTH_CACHE_KEY = '__guildRecoverableAuthCache';

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

function readLocalRecoverableAuth() {
  if (!canUseLocalStorage()) return null;
  try {
    return JSON.parse(window.localStorage.getItem('auth') || 'null');
  } catch {
    return null;
  }
}

function readStagedRecoverableAuth() {
  if (!isBrowserRuntime()) return null;
  try {
    const auth = window[RECOVERABLE_AUTH_CACHE_KEY];
    return auth && typeof auth === 'object' ? auth : null;
  } catch {
    return null;
  }
}

function clearLocalRecoverableAuth() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem('auth');
}

function clearStagedRecoverableAuth() {
  if (!isBrowserRuntime()) return;
  try {
    window[RECOVERABLE_AUTH_CACHE_KEY] = null;
  } catch {}
}

export function isInsecureConnection() {
  return isInsecureServerUrl(getServerUrl());
}

export function setServerUrl(url) {
  const normalized = normalizeConfiguredServerUrl(url, {
    migrateServerUrlFn: migrateKnownProductionServerUrl,
  });
  if (normalized && isInsecureServerUrl(normalized)) {
    console.warn('[Security] Server URL uses unencrypted HTTP. Auth tokens and messages will be sent in plaintext. Use HTTPS in production.');
  }
  localStorage.setItem('serverUrl', normalized);
}

export function getServerUrl() {
  let runtimeServerUrl = '';
  try {
    runtimeServerUrl = migrateKnownProductionServerUrl(
      new URLSearchParams(window.location.search).get('serverUrl')
    );
  } catch {}

  if (isElectronRuntime() && runtimeServerUrl) {
    return runtimeServerUrl.replace(/\/+$/, '');
  }

  const stored = migrateKnownProductionServerUrl(localStorage.getItem('serverUrl'));
  if (stored) {
    if (stored !== localStorage.getItem('serverUrl')) {
      localStorage.setItem('serverUrl', stored);
    }
    return stored;
  }
  if (runtimeServerUrl) return runtimeServerUrl.replace(/\/+$/, '');
  if (ENV_DEFAULT_SERVER_URL) return ENV_DEFAULT_SERVER_URL;
  return env.DEV ? DEV_DEFAULT_SERVER_URL : PACKAGED_DEFAULT_SERVER_URL;
}

export function toServerConnectionError(error, serverUrl = getServerUrl()) {
  return buildServerConnectionError(error, serverUrl);
}

function getAuth() {
  const stagedAuth = readStagedRecoverableAuth();
  if (stagedAuth?.token) {
    return stagedAuth;
  }

  if (isElectronRuntime()) {
    try {
      const electronAuth = window.electronAPI?.authStateGetSync?.();
      if (electronAuth && typeof electronAuth === 'object') {
        clearLocalRecoverableAuth();
        return electronAuth;
      }
    } catch {}
  }

  return readLocalRecoverableAuth() || {};
}

export function getAuthHeaders(extra = {}) {
  const auth = getAuth();
  const headers = { ...extra };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

let sessionExpired = false;
export function handleSessionExpiry(status) {
  if (status === 401 && !sessionExpired) {
    sessionExpired = true;
    clearStagedRecoverableAuth();
    clearLocalRecoverableAuth();
    if (isElectronRuntime()) {
      window.electronAPI?.authStateClear?.().catch?.((err) => {
        console.warn('[AuthStorage] Failed to clear desktop auth state:', err?.message || err);
      });
    }
    window.dispatchEvent(new Event('session-expired'));
  }
}

export function resetSessionExpiry() {
  sessionExpired = false;
}

export function getFileUrl(filePath) {
  const auth = getAuth();
  return buildAuthenticatedFileUrl({
    filePath,
    authToken: auth.token,
    serverUrl: getServerUrl(),
  });
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      ...options,
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
        ...options.headers,
      }),
    });
  } catch (error) {
    throw toServerConnectionError(error);
  }
  if (!res.ok) {
    handleSessionExpiry(res.status);
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function apiNoAuth(path, options = {}) {
  let res;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    throw toServerConnectionError(error);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}
