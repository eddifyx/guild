import type { MobileSessionUser } from './mobileSessionTypes';

export type SessionUser = Omit<MobileSessionUser, 'serverUrl'>;

export type StoredSession = {
  serverUrl: string;
  user: SessionUser;
};
