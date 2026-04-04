import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { connectSocket, disconnectSocket } from '../socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    if (!user.token) {
      return;
    }
    const s = connectSocket(user.token);
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      const authErrors = ['Authentication required', 'Invalid or expired session', 'User not found'];
      if (authErrors.includes(err.message)) {
        s.disconnect();
        logout();
      }
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      disconnectSocket();
      setSocket(null);
      setConnected(false);
    };
  }, [user, logout]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
