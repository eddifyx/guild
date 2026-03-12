import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { rememberUsers } from '../crypto/identityDirectory.js';

export function useOnlineUsers() {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!socket) {
      console.log('[useOnlineUsers] no socket');
      return;
    }

    console.log('[useOnlineUsers] effect running, socket.connected:', socket.connected, 'socket.id:', socket.id);

    const handler = ({ onlineUsers: list }) => {
      console.log('[useOnlineUsers] received presence:update, count:', list?.length, list);
      rememberUsers(list);
      setOnlineUsers(list);
    };

    // Re-request presence whenever the socket (re)connects
    const onConnect = () => {
      console.log('[useOnlineUsers] socket connected, requesting presence');
      socket.emit('presence:request');
    };

    socket.on('presence:update', handler);
    socket.on('connect', onConnect);

    // Also request immediately in case already connected
    if (socket.connected) {
      console.log('[useOnlineUsers] already connected, requesting presence now');
      socket.emit('presence:request');
    }

    return () => {
      socket.off('presence:update', handler);
      socket.off('connect', onConnect);
    };
  }, [socket]);

  const onlineIds = useMemo(() => new Set(onlineUsers.map(u => u.userId)), [onlineUsers]);

  return { onlineUsers, onlineIds };
}
