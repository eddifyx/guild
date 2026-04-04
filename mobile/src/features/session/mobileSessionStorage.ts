import * as SecureStore from 'expo-secure-store';

import type { MobileSessionUser } from './mobileSessionTypes';

const SESSION_KEY = 'guild.mobile.session.v1';

const storageOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function normalizeStoredSession(input: unknown): MobileSessionUser | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;

  if (
    typeof candidate.userId !== 'string' ||
    typeof candidate.token !== 'string' ||
    typeof candidate.serverUrl !== 'string'
  ) {
    return null;
  }

  return {
    userId: candidate.userId,
    username: typeof candidate.username === 'string' ? candidate.username : '',
    avatarColor: typeof candidate.avatarColor === 'string' ? candidate.avatarColor : null,
    npub: typeof candidate.npub === 'string' ? candidate.npub : null,
    profilePicture: typeof candidate.profilePicture === 'string' ? candidate.profilePicture : null,
    token: candidate.token,
    serverUrl: candidate.serverUrl,
  };
}

export async function readStoredSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY, storageOptions);
  if (!raw) return null;

  try {
    return normalizeStoredSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: MobileSessionUser) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), storageOptions);
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY, storageOptions);
}
