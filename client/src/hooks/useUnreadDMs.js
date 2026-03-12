import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export function useUnreadDMs(activeConversation) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const activeRef = useRef(activeConversation);
  activeRef.current = activeConversation;

  useEffect(() => {
    if (!socket || !user) return;

    const onDMMessage = (msg) => {
      if (msg.sender_id === user.userId) return;
      const active = activeRef.current;
      if (active?.type === 'dm' && active.id === msg.sender_id) return;

      setCounts(prev => ({
        ...prev,
        [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
      }));
    };

    socket.on('dm:message', onDMMessage);
    return () => socket.off('dm:message', onDMMessage);
  }, [socket, user]);

  const clearUnread = useCallback((userId) => {
    setCounts(prev => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  return { unreadCounts: counts, clearUnread };
}
