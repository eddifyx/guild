import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function normalizeBaseUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/+$/, '');
}

const AUTH_ERRORS = new Set([
  'Authentication required',
  'Invalid or expired session',
  'User not found',
]);

export function usePresenceSocket({
  serverUrl,
  token,
  enabled,
  onUnauthorized = () => {},
}: {
  serverUrl: string;
  token: string | null;
  enabled: boolean;
  onUnauthorized?: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !token || !serverUrl.trim()) {
      setConnected(false);
      setOnlineUsers([]);
      return;
    }

    const socket = io(normalizeBaseUrl(serverUrl), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onConnect = () => {
      setConnected(true);
      setError('');
      socket.emit('presence:request');
    };
    const onDisconnect = () => {
      setConnected(false);
    };
    const onPresenceUpdate = (payload: { onlineUsers?: string[] }) => {
      setOnlineUsers(Array.isArray(payload?.onlineUsers) ? payload.onlineUsers : []);
    };
    const onConnectError = (err: Error) => {
      setConnected(false);
      setError(err.message || 'Socket connection failed.');
      if (AUTH_ERRORS.has(err.message)) {
        onUnauthorized();
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [enabled, onUnauthorized, serverUrl, token]);

  return {
    connected,
    onlineUsers,
    error,
  };
}
