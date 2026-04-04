import {
  clearStoredSession as clearMobileStoredSession,
  readStoredSession,
  writeStoredSession,
} from './mobileSessionStorage';
import type { StoredSession } from './sessionTypes';

export async function loadStoredSession() {
  const session = await readStoredSession();
  if (!session) {
    return null;
  }

  const { serverUrl, ...user } = session;
  return { serverUrl, user };
}

export async function persistStoredSession(session: StoredSession) {
  await writeStoredSession({
    ...session.user,
    serverUrl: session.serverUrl,
  });
}

export async function clearStoredSession() {
  await clearMobileStoredSession();
}
