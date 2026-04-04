import {
  buildDirectMessageNotificationDescriptor,
  buildRoomMessageNotificationDescriptor,
  evaluateDirectMessageNotification,
  evaluateRoomMessageNotification,
  resolveNotificationRouteAction,
} from './notificationPolicyCore.mjs';

import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';

export const MESSAGING_NOTIFICATION_EVENT_NAMES = Object.freeze({
  roomMessage: 'room:message',
  directMessage: 'dm:message',
});

export function createMessagingNotificationHandlers({
  activeConversation = null,
  rooms = [],
  currentUserId = null,
  getNotificationContext = () => ({
    activeConversation,
    appForegrounded: false,
    muteAll: false,
    muteRooms: false,
    muteDMs: false,
  }),
  evaluateRoomNotification = evaluateRoomMessageNotification,
  evaluateDirectNotification = evaluateDirectMessageNotification,
  buildRoomDescriptor = buildRoomMessageNotificationDescriptor,
  buildDirectDescriptor = buildDirectMessageNotificationDescriptor,
  presentNotification = () => false,
} = {}) {
  return {
    onRoomMessage(message) {
      if (message?.sender_id === currentUserId) return false;

      const notificationContext = getNotificationContext({
        activeConversation,
      });
      const decision = evaluateRoomNotification({
        ...notificationContext,
        roomId: message?.room_id,
      });
      if (!decision.shouldNotify) return false;

      void presentNotification({
        descriptor: buildRoomDescriptor({
          message,
          rooms,
        }),
        diagnosticEvent: 'room_notification_requested',
        diagnosticContext: {
          roomId: message?.room_id || null,
          messageId: message?.id || null,
        },
      });
      return true;
    },

    onDirectMessage(message) {
      if (message?.sender_id === currentUserId) return false;

      const notificationContext = getNotificationContext({
        activeConversation,
      });
      const decision = evaluateDirectNotification({
        ...notificationContext,
        otherUserId: message?.sender_id,
      });
      if (!decision.shouldNotify) return false;

      void presentNotification({
        descriptor: buildDirectDescriptor({
          message,
        }),
        diagnosticEvent: 'dm_notification_requested',
        diagnosticContext: {
          userId: message?.sender_id || null,
          messageId: message?.id || null,
        },
      });
      return true;
    },
  };
}

export function registerMessagingNotificationSubscriptions(socket, handlers = {}) {
  if (!socket?.on || !socket?.off) {
    return () => {};
  }

  socket.on(MESSAGING_NOTIFICATION_EVENT_NAMES.roomMessage, handlers.onRoomMessage);
  socket.on(MESSAGING_NOTIFICATION_EVENT_NAMES.directMessage, handlers.onDirectMessage);

  return () => {
    socket.off(MESSAGING_NOTIFICATION_EVENT_NAMES.roomMessage, handlers.onRoomMessage);
    socket.off(MESSAGING_NOTIFICATION_EVENT_NAMES.directMessage, handlers.onDirectMessage);
  };
}

export function routeSystemNotificationAction(payload = {}, {
  myRooms = [],
  rooms = [],
  clearConversationPerfTrace = () => {},
  clearGuildChatUnreadMentions = () => {},
  handleSelectDM = () => {},
  handleSelectRoom = () => {},
  focusGuildChatComposer = () => {},
  setConversationHome = () => {},
  diagnosticFn = recordLaneDiagnostic,
} = {}) {
  const routeAction = resolveNotificationRouteAction(payload, {
    myRooms,
    rooms,
  });
  if (!routeAction) return null;

  if (routeAction.kind === 'dm') {
    diagnosticFn('messaging', 'system_notification_action', {
      routeType: 'dm',
      userId: routeAction.conversation.other_user_id,
    });
    handleSelectDM(routeAction.conversation);
    return routeAction;
  }

  if (routeAction.kind === 'room') {
    diagnosticFn('messaging', 'system_notification_action', {
      routeType: 'room',
      roomId: routeAction.room.id,
    });
    handleSelectRoom(routeAction.room);
    return routeAction;
  }

  if (routeAction.kind === 'guildchat-home') {
    diagnosticFn('messaging', 'system_notification_action', {
      routeType: 'guildchat-mention',
      guildId: routeAction.guildId,
    });
    clearConversationPerfTrace('guildchat-home');
    clearGuildChatUnreadMentions();
    setConversationHome();
    focusGuildChatComposer();
    return routeAction;
  }

  return routeAction;
}
