import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMessagingNotificationHandlers,
  MESSAGING_NOTIFICATION_EVENT_NAMES,
  registerMessagingNotificationSubscriptions,
  routeSystemNotificationAction,
} from '../../../client/src/features/messaging/notificationRuntimeFlow.mjs';

test('messaging notification handlers request room and DM notifications only for other users', () => {
  const presented = [];
  const handlers = createMessagingNotificationHandlers({
    activeConversation: { type: 'room', id: 'room-9' },
    rooms: [{ id: 'room-2', name: 'war-room' }],
    currentUserId: 'user-1',
    getNotificationContext: () => ({
      activeConversation: { type: 'dm', id: 'user-9' },
      appForegrounded: false,
      muteRooms: false,
      muteDMs: false,
    }),
    presentNotification: (payload) => presented.push(payload),
  });

  assert.equal(handlers.onRoomMessage({
    id: 'message-1',
    sender_id: 'user-2',
    room_id: 'room-2',
    sender_name: 'Scout',
    content: 'hello room',
    encrypted: false,
  }), true);
  assert.equal(handlers.onDirectMessage({
    id: 'message-2',
    sender_id: 'user-3',
    sender_name: 'Builder',
    sender_npub: 'npub1builder',
    content: 'hello dm',
    encrypted: false,
  }), true);
  assert.equal(handlers.onDirectMessage({
    id: 'message-3',
    sender_id: 'user-1',
    content: 'self',
  }), false);

  assert.deepEqual(
    presented.map((entry) => [entry.diagnosticEvent, entry.descriptor.route.type]),
    [
      ['room_notification_requested', 'room'],
      ['dm_notification_requested', 'dm'],
    ]
  );
});

test('messaging notification subscriptions bind and unbind the canonical socket events', () => {
  const calls = [];
  const socket = {
    on(eventName, handler) {
      calls.push(['on', eventName, handler]);
    },
    off(eventName, handler) {
      calls.push(['off', eventName, handler]);
    },
  };
  const handlers = {
    onRoomMessage() {},
    onDirectMessage() {},
  };

  const unsubscribe = registerMessagingNotificationSubscriptions(socket, handlers);
  unsubscribe();

  assert.deepEqual(
    calls.map(([method, eventName]) => [method, eventName]),
    [
      ['on', MESSAGING_NOTIFICATION_EVENT_NAMES.roomMessage],
      ['on', MESSAGING_NOTIFICATION_EVENT_NAMES.directMessage],
      ['off', MESSAGING_NOTIFICATION_EVENT_NAMES.roomMessage],
      ['off', MESSAGING_NOTIFICATION_EVENT_NAMES.directMessage],
    ]
  );
});

test('system notification routing delegates DM, room, and guild chat destinations through one flow', () => {
  const traces = [];
  const dmSelections = [];
  const roomSelections = [];
  let guildChatFocusCount = 0;
  let conversationHomeCount = 0;

  const routeDm = routeSystemNotificationAction({
    type: 'dm',
    userId: 'user-2',
    username: 'Scout',
    npub: 'npub1scout',
  }, {
    handleSelectDM: (conversation) => dmSelections.push(conversation),
    diagnosticFn: (...args) => traces.push(args),
  });

  const routeRoom = routeSystemNotificationAction({
    type: 'room',
    roomId: 'room-7',
    roomName: 'war-room',
  }, {
    myRooms: [{ id: 'room-7', name: 'war-room' }],
    handleSelectRoom: (room) => roomSelections.push(room),
    diagnosticFn: (...args) => traces.push(args),
  });

  const routeGuildChat = routeSystemNotificationAction({
    type: 'guildchat-mention',
    guildId: 'guild-1',
  }, {
    clearConversationPerfTrace: (traceId) => traces.push(['perf', traceId]),
    clearGuildChatUnreadMentions: () => {
      traces.push(['unread']);
    },
    setConversationHome: () => {
      conversationHomeCount += 1;
    },
    focusGuildChatComposer: () => {
      guildChatFocusCount += 1;
    },
    diagnosticFn: (...args) => traces.push(args),
  });

  assert.equal(routeDm.kind, 'dm');
  assert.equal(routeRoom.kind, 'room');
  assert.equal(routeGuildChat.kind, 'guildchat-home');
  assert.deepEqual(dmSelections, [{
    other_user_id: 'user-2',
    other_username: 'Scout',
    other_npub: 'npub1scout',
  }]);
  assert.deepEqual(roomSelections, [{
    id: 'room-7',
    name: 'war-room',
  }]);
  assert.equal(conversationHomeCount, 1);
  assert.equal(guildChatFocusCount, 1);
});
