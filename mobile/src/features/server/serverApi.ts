export type ServerVersionPayload = {
  version?: string;
  notes?: string | null;
  mandatory?: boolean;
  url?: string | null;
  downloadPageUrl?: string | null;
  [key: string]: unknown;
};

export type AuthChallengePayload = {
  challenge: string;
  authPubkey?: string | null;
};

function normalizeBaseUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/+$/, '');
}

async function requestJson<T>(baseUrl: string, path: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error('Add an API base URL first.');
  }

  const response = await fetch(`${normalizedBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : response.statusText || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export function fetchServerVersion(baseUrl: string, platform: 'ios' | 'android') {
  return requestJson<ServerVersionPayload>(baseUrl, `/api/version?platform=${platform}`);
}

export function fetchAuthChallenge(baseUrl: string) {
  return requestJson<AuthChallengePayload>(baseUrl, '/api/auth/nostr/challenge');
}
