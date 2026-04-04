import { authenticateWithNsec } from './mobileNostrAuth';
import type { SessionUser } from './sessionTypes';

export async function loginWithNsec(nsec: string, serverUrl: string) {
  const session = await authenticateWithNsec(nsec, serverUrl);
  const { serverUrl: _serverUrl, ...user } = session;
  return user as SessionUser;
}
