/**
 * Returns true if a URL is a local/dev address (localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x).
 */
function isLocalUrl(url) {
  if (!url) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i.test(url);
}

/**
 * Returns true if the server URL is using unencrypted HTTP on a non-local address.
 * UI should show a prominent warning when this is true.
 */
export function isInsecureConnection() {
  const url = getServerUrl();
  return url.startsWith('http://') && !isLocalUrl(url);
}

export function setServerUrl(url) {
  // Auto-prepend http:// if no protocol specified
  let normalized = (url || '').trim();
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }
  if (normalized && normalized.startsWith('http://') && !isLocalUrl(normalized)) {
    console.warn('[Security] Server URL uses unencrypted HTTP. Auth tokens and messages will be sent in plaintext. Use HTTPS in production.');
  }
  localStorage.setItem('serverUrl', normalized);
}

export function getServerUrl() {
  return localStorage.getItem('serverUrl') || 'http://localhost:3001';
}

function toAbsoluteServerUrl(url, serverUrl = getServerUrl()) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${serverUrl}${url}`;
  return `${serverUrl}/${url.replace(/^\/+/, '')}`;
}

function isNetworkFetchError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'TypeError'
    || message === 'failed to fetch'
    || message.includes('networkerror')
    || message.includes('load failed');
}

export function toServerConnectionError(error, serverUrl = getServerUrl()) {
  if (!isNetworkFetchError(error)) {
    return error instanceof Error ? error : new Error(String(error || 'Request failed'));
  }

  return new Error(`Cannot reach the /guild server at ${serverUrl}. Make sure it is running, then try again.`);
}

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem('auth') || '{}');
  } catch {
    return {};
  }
}

function getAuthHeaders(extra = {}) {
  const auth = getAuth();
  const headers = { ...extra };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  return headers;
}

let _sessionExpired = false;
function handleSessionExpiry(status) {
  if (status === 401 && !_sessionExpired) {
    _sessionExpired = true;
    localStorage.removeItem('auth');
    window.dispatchEvent(new Event('session-expired'));
  }
}

/** Reset session-expired flag so future 401s trigger auto-logout again. Call on login. */
export function resetSessionExpiry() {
  _sessionExpired = false;
}

/**
 * Build an authenticated URL for uploaded files (images, attachments, etc.).
 * Appends the session token as a query parameter so <img>/<video>/<audio> tags work.
 */
export function getFileUrl(filePath) {
  if (!filePath) return '';
  const auth = getAuth();
  const serverUrl = getServerUrl();
  // SECURITY: Only append auth tokens to our own server's URLs.
  // A malicious sender could craft an attachment URL like https://evil.com/uploads/steal
  // causing the victim's client to send its session token to an attacker-controlled server.
  let base;
  if (filePath.startsWith('http')) {
    try {
      const fileOrigin = new URL(filePath).origin;
      const serverOrigin = new URL(serverUrl).origin;
      if (fileOrigin !== serverOrigin) {
        return filePath; // External URL — return without token
      }
    } catch {
      return filePath;
    }
    base = filePath;
  } else {
    base = `${serverUrl}${filePath}`;
  }
  if (auth.token && (base.includes('/uploads/') || base.includes('/api/files/'))) {
    try {
      const parsed = new URL(base);
      if (!parsed.searchParams.has('token')) {
        parsed.searchParams.set('token', auth.token);
      }
      return parsed.toString();
    } catch {
      const separator = base.includes('?') ? '&' : '?';
      return base.includes('token=')
        ? base
        : `${base}${separator}token=${encodeURIComponent(auth.token)}`;
    }
  }
  return base;
}

/**
 * Authenticated API call — includes Bearer token from stored auth.
 */
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

/**
 * Unauthenticated API call — for challenge and login endpoints.
 */
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

export async function uploadFile(file) {
  let res;
  try {
    res = await fetch(`${getServerUrl()}/api/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
    });
  } catch (error) {
    throw toServerConnectionError(error);
  }
  if (!res.ok) {
    handleSessionExpiry(res.status);
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function checkLatestVersion() {
  try {
    const localVersion = await window.electronAPI?.getAppVersion?.() || '0.0.0';
    const platform = window.electronAPI?.getPlatform?.() || process.platform || 'unknown';
    const serverUrl = getServerUrl();
    const res = await fetch(`${serverUrl}/api/version?platform=${platform}&localVersion=${encodeURIComponent(localVersion)}`);
    if (!res.ok) {
      return {
        hasUpdate: false,
        localVersion,
        remoteVersion: null,
        updateStrategy: 'native',
        downloadPageUrl: null,
        platformDownload: null,
      };
    }
    const payload = await res.json();
    const { version: remoteVersion } = payload;
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);
    const hasUpdate = remote[0] > local[0]
      || (remote[0] === local[0] && remote[1] > local[1])
      || (remote[0] === local[0] && remote[1] === local[1] && remote[2] > local[2]);
    const rawPlatformDownload = payload?.downloads?.[platform] || null;
    const platformDownload = rawPlatformDownload ? {
      ...rawPlatformDownload,
      installerUrl: toAbsoluteServerUrl(rawPlatformDownload.installerUrl, serverUrl),
      archiveUrl: toAbsoluteServerUrl(rawPlatformDownload.archiveUrl, serverUrl),
    } : null;

    return {
      hasUpdate,
      localVersion,
      remoteVersion,
      updateStrategy: payload?.updateStrategy || 'native',
      manualInstallReason: payload?.manualInstallReason || null,
      downloadPageUrl: toAbsoluteServerUrl(payload?.downloadPageUrl, serverUrl),
      platformDownload,
    };
  } catch {
    return {
      hasUpdate: false,
      localVersion: null,
      remoteVersion: null,
      updateStrategy: 'native',
      manualInstallReason: null,
      downloadPageUrl: null,
      platformDownload: null,
    };
  }
}

export function uploadAddonFile(file, description, onProgress) {
  return new Promise((resolve, reject) => {
    const auth = getAuth();
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getServerUrl()}/api/addons`);
    if (auth.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) { handleSessionExpiry(401); reject(new Error('Session expired')); return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid server response')); }
      } else {
        let msg = 'Addon upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

// ---------------------------------------------------------------------------
// E2E Encryption key management API
// ---------------------------------------------------------------------------

export async function uploadPreKeyBundle(bundle) {
  return api('/api/keys/bundle', {
    method: 'POST',
    body: JSON.stringify(bundle),
  });
}

export async function fetchPreKeyBundle(userId) {
  return api(`/api/keys/bundle/${userId}`);
}

export async function fetchIdentityAttestation(userId) {
  return api(`/api/keys/identity/${userId}`);
}

export async function getOTPCount() {
  return api('/api/keys/count');
}

export async function resetEncryptionKeys() {
  return api('/api/keys/reset', { method: 'DELETE' });
}

export async function replenishOTPs(oneTimePreKeys) {
  return api('/api/keys/replenish', {
    method: 'POST',
    body: JSON.stringify({ oneTimePreKeys }),
  });
}

export async function replenishKyberPreKeys(kyberPreKeys) {
  return api('/api/keys/replenish-kyber', {
    method: 'POST',
    body: JSON.stringify({ kyberPreKeys }),
  });
}


export async function checkNpubs(npubs) {
  return api('/api/users/check-npubs', {
    method: 'POST',
    body: JSON.stringify({ npubs }),
  });
}

export async function deleteUploadedFile(fileId) {
  return api(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export async function uploadEncryptedFile(encryptedBlob, filename) {
  const formData = new FormData();
  formData.append('file', encryptedBlob, filename);
  formData.append('scope', 'chat-attachment');
  let res;
  try {
    res = await fetch(`${getServerUrl()}/api/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
  } catch (error) {
    throw toServerConnectionError(error);
  }
  if (!res.ok) {
    handleSessionExpiry(res.status);
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export function uploadAssetFile(file, description, onProgress) {
  return new Promise((resolve, reject) => {
    const auth = getAuth();
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getServerUrl()}/api/assets`);
    if (auth.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) { handleSessionExpiry(401); reject(new Error('Session expired')); return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        let msg = 'Asset upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export async function lookupUsersByNpubs(npubs) {
  const result = await api('/api/users/lookup-npubs', {
    method: 'POST',
    body: JSON.stringify({ npubs }),
  });
  return Array.isArray(result?.users) ? result.users : [];
}

export async function lookupUserByNpub(npub) {
  const users = await lookupUsersByNpubs([npub]);
  return users[0] || null;
}

export async function getContacts() {
  return api('/api/contacts');
}

export async function removeContact(npub) {
  return api(`/api/contacts/${encodeURIComponent(npub)}`, {
    method: 'DELETE',
  });
}

export async function sendFriendRequest(toNpub) {
  return api('/api/friend-requests', {
    method: 'POST',
    body: JSON.stringify({ toNpub }),
  });
}

export async function getIncomingRequests() {
  return api('/api/friend-requests/incoming');
}

export async function getSentRequests() {
  return api('/api/friend-requests/sent');
}

export async function acceptFriendRequest(id) {
  return api(`/api/friend-requests/${id}/accept`, {
    method: 'POST',
  });
}

export async function rejectFriendRequest(id) {
  return api(`/api/friend-requests/${id}/reject`, {
    method: 'POST',
  });
}
