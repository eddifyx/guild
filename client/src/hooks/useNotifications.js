import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getMessagingNotificationContext,
  presentMessagingNotification,
} from '../features/messaging/notificationPolicy';
import {
  createMessagingNotificationHandlers,
  registerMessagingNotificationSubscriptions,
} from '../features/messaging/notificationRuntimeFlow.mjs';

export function useNotifications(activeConversation, rooms = []) {
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket || !user) return;
    const handlers = createMessagingNotificationHandlers({
      activeConversation,
      rooms,
      currentUserId: user.userId,
      getNotificationContext: getMessagingNotificationContext,
      presentNotification: presentMessagingNotification,
    });
    return registerMessagingNotificationSubscriptions(socket, handlers);
  }, [socket, user, activeConversation, rooms]);
}
