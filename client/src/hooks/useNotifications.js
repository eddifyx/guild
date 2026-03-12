import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { playMessageChime } from '../utils/chime';

export function useNotifications(activeConversation) {
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket || !user) return;

    const onRoomMessage = (msg) => {
      if (msg.sender_id === user.userId) return;
      if (activeConversation?.type === 'room' && activeConversation.id === msg.room_id) return;
      const muteRooms = localStorage.getItem('notify:muteRooms') === 'true';
      if (muteRooms) return;
      playMessageChime();
      if (window.electronAPI) {
        window.electronAPI.showNotification(
          msg.sender_name,
          msg.content || 'Sent an attachment'
        );
      }
    };

    const onDMMessage = (msg) => {
      if (msg.sender_id === user.userId) return;
      if (activeConversation?.type === 'dm' && activeConversation.id === msg.sender_id) return;
      const muteDMs = localStorage.getItem('notify:muteDMs') === 'true';
      if (muteDMs) return;
      playMessageChime();
      if (window.electronAPI) {
        window.electronAPI.showNotification(
          msg.sender_name,
          msg.content || 'Sent an attachment'
        );
      }
    };

    socket.on('room:message', onRoomMessage);
    socket.on('dm:message', onDMMessage);

    return () => {
      socket.off('room:message', onRoomMessage);
      socket.off('dm:message', onDMMessage);
    };
  }, [socket, user, activeConversation]);
}
