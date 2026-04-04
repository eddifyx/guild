export function normalizeServerUrl(rawUrl) {
  return (rawUrl || '').trim().replace(/\/+$/, '');
}

export function parseServerUrlList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map(normalizeServerUrl)
    .filter(Boolean);
}

export function migrateKnownServerUrl(
  rawUrl,
  {
    canonicalServerUrl,
    knownLegacyServerUrls,
  } = {},
) {
  const normalized = normalizeServerUrl(rawUrl);
  if (!normalized) {
    return '';
  }
  return knownLegacyServerUrls?.has(normalized) ? canonicalServerUrl : normalized;
}

export function normalizeConfiguredServerUrl(
  rawUrl,
  {
    migrateServerUrlFn = (value) => value,
  } = {},
) {
  let normalized = normalizeServerUrl(rawUrl);
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return migrateServerUrlFn(normalized);
}

export function isLocalServerUrl(url) {
  if (!url) {
    return false;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i.test(url);
}

export function isInsecureServerUrl(url) {
  return String(url || '').startsWith('http://') && !isLocalServerUrl(url);
}

export function toAbsoluteServerUrl(url, serverUrl) {
  if (!url) {
    return null;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${serverUrl}${url}`;
  }
  return `${serverUrl}/${url.replace(/^\/+/, '')}`;
}

export function isNetworkFetchError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'TypeError'
    || message === 'failed to fetch'
    || message.includes('networkerror')
    || message.includes('load failed');
}

export function buildServerConnectionError(error, serverUrl) {
  if (!isNetworkFetchError(error)) {
    return error instanceof Error ? error : new Error(String(error || 'Request failed'));
  }

  return new Error(`Cannot reach the /guild server at ${serverUrl}. Make sure it is running, then try again.`);
}

export function buildAuthenticatedFileUrl({
  filePath,
  authToken,
  serverUrl,
}) {
  if (!filePath) {
    return '';
  }

  let base;
  if (filePath.startsWith('http')) {
    try {
      const fileOrigin = new URL(filePath).origin;
      const serverOrigin = new URL(serverUrl).origin;
      if (fileOrigin !== serverOrigin) {
        return filePath;
      }
    } catch {
      return filePath;
    }
    base = filePath;
  } else {
    base = `${serverUrl}${filePath}`;
  }

  if (authToken && (base.includes('/uploads/') || base.includes('/api/files/'))) {
    try {
      const parsed = new URL(base);
      if (!parsed.searchParams.has('token')) {
        parsed.searchParams.set('token', authToken);
      }
      return parsed.toString();
    } catch {
      const separator = base.includes('?') ? '&' : '?';
      return base.includes('token=')
        ? base
        : `${base}${separator}token=${encodeURIComponent(authToken)}`;
    }
  }

  return base;
}
