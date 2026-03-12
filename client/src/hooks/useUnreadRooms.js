import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export function useUnreadRooms(activeConversation) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const activeRef = useRef(activeConversation);
  activeRef.current = activeConversation;

  useEffect(() => {
    if (!socket || !user) return;

    const onRoomMessage = (msg) => {
      if (msg.sender_id === user.userId) return;
      const active = activeRef.current;
      if (active?.type === 'room' && active.id === msg.room_id) return;

      setCounts(prev => ({
        ...prev,
        [msg.room_id]: (prev[msg.room_id] || 0) + 1,
      }));
    };

    socket.on('room:message', onRoomMessage);
    return () => socket.off('room:message', onRoomMessage);
  }, [socket, user]);

  const clearUnread = useCallback((roomId) => {
    setCounts(prev => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  return { unreadRoomCounts: counts, clearUnreadRoom: clearUnread };
}
