import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getConfiguredApiBaseUrl } from '../../config/mobileConfig';
import { authenticateWithNsec } from './mobileNostrAuth';
import { clearStoredSession, readStoredSession, writeStoredSession } from './mobileSessionStorage';
import type { MobileSessionState, MobileSessionUser } from './mobileSessionTypes';

const AUTH_ERROR_MESSAGES = new Set([
  'Authentication required',
  'Invalid or expired session',
  'User not found',
]);

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function notifyServerLogout(session: MobileSessionUser) {
  const normalizedServerUrl = normalizeServerUrl(session.serverUrl);
  if (!normalizedServerUrl || !session.token) return;

  await fetch(`${normalizedServerUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
  });
}

export function useMobileSession(): MobileSessionState {
  const [session, setSession] = useState<MobileSessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [serverUrlDraft, setServerUrlDraft] = useState(getConfiguredApiBaseUrl());
  const socketRef = useRef<Socket | null>(null);

  const teardownSocket = useCallback(() => {
    const current = socketRef.current;
    if (!current) return;
    current.removeAllListeners();
    current.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const restored = await readStoredSession();
        if (cancelled) return;
        if (restored) {
          setSession(restored);
          setServerUrlDraft(restored.serverUrl);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    const currentSession = session;
    teardownSocket();
    setSession(null);
    setLoginError('');
    await Promise.allSettled([
      currentSession ? notifyServerLogout(currentSession) : Promise.resolve(),
      clearStoredSession(),
    ]);
  }, [session, teardownSocket]);

  useEffect(() => {
    if (!session?.token || !session.serverUrl) {
      teardownSocket();
      return;
    }

    const nextSocket = io(session.serverUrl, {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (error: Error) => {
      setConnected(false);
      if (AUTH_ERROR_MESSAGES.has(error.message)) {
        void logout();
      }
    };

    nextSocket.on('connect', onConnect);
    nextSocket.on('disconnect', onDisconnect);
    nextSocket.on('connect_error', onConnectError);

    return () => {
      nextSocket.off('connect', onConnect);
      nextSocket.off('disconnect', onDisconnect);
      nextSocket.off('connect_error', onConnectError);
      if (socketRef.current === nextSocket) {
        teardownSocket();
      }
    };
  }, [logout, session?.serverUrl, session?.token, teardownSocket]);

  const loginWithNsec = useCallback(async (nsec: string, overrideServerUrl?: string) => {
    setLoggingIn(true);
    setLoginError('');

    try {
      const normalizedNsec = nsec.trim();
      const normalizedServerUrl = (overrideServerUrl || serverUrlDraft).trim();

      if (!normalizedServerUrl) {
        throw new Error('Add a server URL before logging in.');
      }
      if (!normalizedNsec) {
        throw new Error('Add an nsec before logging in.');
      }

      const nextSession = await authenticateWithNsec(normalizedNsec, normalizedServerUrl);
      setSession(nextSession);
      setServerUrlDraft(nextSession.serverUrl);
      await writeStoredSession(nextSession);
      return true;
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, [serverUrlDraft]);

  return useMemo(() => ({
    session,
    socket,
    connected,
    booting,
    loggingIn,
    loginError,
    serverUrlDraft,
    setServerUrlDraft,
    loginWithNsec,
    logout,
  }), [
    booting,
    connected,
    loggingIn,
    loginError,
    loginWithNsec,
    logout,
    serverUrlDraft,
    session,
    socket,
  ]);
}
