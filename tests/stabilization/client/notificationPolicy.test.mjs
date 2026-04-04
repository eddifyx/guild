import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectMessageNotificationDescriptor,
  buildGuildChatMentionNotificationDescriptor,
  buildRoomMessageNotificationDescriptor,
  evaluateDirectMessageNotification,
  evaluateGuildChatMentionNotification,
  evaluateRoomMessageNotification,
  resolveNotificationRouteAction,
} from '../../../client/src/features/messaging/notificationPolicyCore.mjs';

test('room notifications are suppressed when the room is foregrounded', () => {
  const decision = evaluateRoomMessageNotification({
    activeConversation: { type: 'room', id: 'room-1' },
    roomId: 'room-1',
    appForegrounded: true,
    muteRooms: false,
  });

  assert.deepEqual(decision, {
    shouldNotify: false,
    reason: 'foreground-visible',
  });
});

test('direct message notifications are suppressed when DM notifications are muted', () => {
  const decision = evaluateDirectMessageNotification({
    activeConversation: { type: 'room', id: 'room-1' },
    otherUserId: 'user-2',
    appForegrounded: false,
    muteDMs: true,
  });

  assert.deepEqual(decision, {
    shouldNotify: false,
    reason: 'muted',
  });
});

test('global mute suppresses DM and guild chat mention notifications universally', () => {
  const dmDecision = evaluateDirectMessageNotification({
    activeConversation: { type: 'room', id: 'room-1' },
    otherUserId: 'user-2',
    appForegrounded: false,
    muteAll: true,
    muteDMs: false,
  });
  const guildChatDecision = evaluateGuildChatMentionNotification({
    currentGuild: 'guild-a',
    messageGuildId: 'guild-a',
    guildChatVisible: false,
    appForegrounded: false,
    muteAll: true,
  });

  assert.deepEqual(dmDecision, {
    shouldNotify: false,
    reason: 'muted',
  });
  assert.deepEqual(guildChatDecision, {
    shouldNotify: false,
    reason: 'muted',
  });
});

test('guild chat mentions notify when /guildchat is not the foreground surface', () => {
  const decision = evaluateGuildChatMentionNotification({
    currentGuild: 'guild-a',
    messageGuildId: 'guild-a',
    guildChatVisible: false,
    appForegrounded: true,
  });

  assert.deepEqual(decision, {
    shouldNotify: true,
    reason: 'notify',
  });
});

test('notification descriptors normalize room, dm, and guildchat routes', () => {
  const roomDescriptor = buildRoomMessageNotificationDescriptor({
    message: {
      room_id: 'room-7',
      sender_name: 'Scout',
      content: 'hello room',
      encrypted: false,
    },
    rooms: [{ id: 'room-7', name: 'general' }],
  });
  const dmDescriptor = buildDirectMessageNotificationDescriptor({
    message: {
      sender_id: 'user-9',
      sender_name: 'Scout',
      sender_npub: 'npub1scout',
      content: 'hello dm',
      encrypted: false,
    },
  });
  const guildChatDescriptor = buildGuildChatMentionNotificationDescriptor({
    message: {
      guildId: 'guild-a',
      senderName: 'Scout',
      content: 'hello guild',
    },
  });

  assert.deepEqual(roomDescriptor.route, {
    type: 'room',
    roomId: 'room-7',
    roomName: 'general',
  });
  assert.deepEqual(dmDescriptor.route, {
    type: 'dm',
    userId: 'user-9',
    username: 'Scout',
    npub: 'npub1scout',
  });
  assert.deepEqual(guildChatDescriptor.route, {
    type: 'guildchat-mention',
    guildId: 'guild-a',
  });
});

test('notification route actions resolve to the correct in-app destination', () => {
  const dmAction = resolveNotificationRouteAction({
    type: 'dm',
    userId: 'user-1',
    username: 'Builder',
    npub: 'npub1builder',
  });
  const roomAction = resolveNotificationRouteAction({
    type: 'room',
    roomId: 'room-2',
    roomName: 'war-room',
  }, {
    myRooms: [{ id: 'room-2', name: 'war-room' }],
  });
  const guildChatAction = resolveNotificationRouteAction({
    type: 'guildchat-mention',
    guildId: 'guild-z',
  });

  assert.deepEqual(dmAction, {
    kind: 'dm',
    conversation: {
      other_user_id: 'user-1',
      other_username: 'Builder',
      other_npub: 'npub1builder',
    },
  });
  assert.deepEqual(roomAction, {
    kind: 'room',
    room: {
      id: 'room-2',
      name: 'war-room',
    },
  });
  assert.deepEqual(guildChatAction, {
    kind: 'guildchat-home',
    guildId: 'guild-z',
  });
});
