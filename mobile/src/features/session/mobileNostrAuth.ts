import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';

import type { MobileSessionUser } from './mobileSessionTypes';

type AuthChallengePayload = {
  challenge: string;
  authPubkey?: string | null;
};

type AuthResponsePayload = {
  userId?: string;
  username?: string;
  avatarColor?: string | null;
  npub?: string | null;
  profilePicture?: string | null;
  token?: string;
};

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, '');
}

function buildLoginAuthEvent(challenge: string, pubkey?: string) {
  return {
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['relay', 'wss://nos.lol/'],
      ['challenge', challenge],
    ],
    content: '',
    ...(pubkey ? { pubkey } : {}),
  };
}

function toSessionUser(payload: AuthResponsePayload, serverUrl: string): MobileSessionUser {
  if (typeof payload.userId !== 'string' || typeof payload.token !== 'string') {
    throw new Error('The server returned an invalid auth payload.');
  }

  return {
    userId: payload.userId,
    username: typeof payload.username === 'string' ? payload.username : '',
    avatarColor: typeof payload.avatarColor === 'string' ? payload.avatarColor : null,
    npub: typeof payload.npub === 'string' ? payload.npub : null,
    profilePicture: typeof payload.profilePicture === 'string' ? payload.profilePicture : null,
    token: payload.token,
    serverUrl,
  };
}

export function decodeNsecForMobile(nsec: string) {
  const decoded = nip19.decode(nsec.trim());
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec. Expected an nsec1... secret key.');
  }

  const secretKey = decoded.data as Uint8Array;
  const pubkey = getPublicKey(secretKey);
  const npub = nip19.npubEncode(pubkey);

  return { secretKey, pubkey, npub };
}

async function fetchJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
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

async function fetchLoginChallenge(serverUrl: string) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  if (!normalizedServerUrl) {
    throw new Error('Add a server URL before logging in.');
  }

  return fetchJson<AuthChallengePayload>(`${normalizedServerUrl}/api/auth/nostr/challenge`);
}

export async function authenticateWithNsec(nsec: string, serverUrl: string) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const { secretKey, pubkey } = decodeNsecForMobile(nsec);
  const { challenge } = await fetchLoginChallenge(normalizedServerUrl);

  if (!challenge) {
    throw new Error('The server did not return a login challenge.');
  }

  const signedEvent = finalizeEvent(buildLoginAuthEvent(challenge, pubkey), secretKey);
  const payload = await fetchJson<AuthResponsePayload>(`${normalizedServerUrl}/api/auth/nostr`, {
    method: 'POST',
    body: JSON.stringify({ signedEvent }),
  });

  return toSessionUser(payload, normalizedServerUrl);
}
