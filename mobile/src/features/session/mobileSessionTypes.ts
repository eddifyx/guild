import type { Socket } from 'socket.io-client';

export type MobileSessionUser = {
  userId: string;
  username: string;
  avatarColor: string | null;
  npub: string | null;
  profilePicture: string | null;
  token: string;
  serverUrl: string;
};

export type MobileSessionState = {
  session: MobileSessionUser | null;
  socket: Socket | null;
  connected: boolean;
  booting: boolean;
  loggingIn: boolean;
  loginError: string;
  serverUrlDraft: string;
  setServerUrlDraft: (value: string) => void;
  loginWithNsec: (nsec: string, serverUrl?: string) => Promise<boolean>;
  logout: () => Promise<void>;
};
