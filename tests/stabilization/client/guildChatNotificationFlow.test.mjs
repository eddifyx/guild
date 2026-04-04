import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildChatMotdEntry,
  clearGuildChatUnreadMentions,
  createGuildChatMentionNotificationHandler,
  markGuildChatUnreadMention,
} from '../../../client/src/features/messaging/guildChatNotificationFlow.mjs';

test('guild chat unread helpers dedupe mentions and clear unread state cleanly', () => {
  const unreadMentionIds = new Set();

  assert.equal(markGuildChatUnreadMention(unreadMentionIds, { id: 'message-1' }), 1);
  assert.equal(markGuildChatUnreadMention(unreadMentionIds, { id: 'message-1' }), 1);
  assert.equal(markGuildChatUnreadMention(unreadMentionIds, { id: 'message-2' }), 2);
  assert.equal(clearGuildChatUnreadMentions(unreadMentionIds), 0);
  assert.equal(unreadMentionIds.size, 0);
});

test('guild chat motd entry builder only emits a session banner when session state is complete', () => {
  assert.equal(buildGuildChatMotdEntry({
    motdText: '',
    sessionStartedAt: 123,
    currentGuild: 'guild-1',
  }), null);

  assert.deepEqual(buildGuildChatMotdEntry({
    motdText: ' stay humble ',
    sessionStartedAt: 1_711_338_400_000,
    currentGuild: 'guild-1',
  }), {
    id: 'motd-guild-1-1711338400000',
    type: 'motd',
    senderName: '/guildchat',
    content: 'stay humble',
    createdAt: new Date(1_711_338_400_000).toISOString(),
  });
});

test('guild chat mention notification handler marks unread and requests a notification when policy allows it', () => {
  const unreadMessages = [];
  const presented = [];
  const diagnostics = [];

  const handleMentionNotification = createGuildChatMentionNotificationHandler({
    currentGuild: 'guild-1',
    currentUserId: 'user-2',
    isGuildChatVisible: () => false,
    shouldNotifyMention: () => true,
    markUnreadMention: (message) => unreadMessages.push(message.id),
    getNotificationContext: () => ({
      currentGuild: 'guild-1',
      guildChatVisible: false,
      appForegrounded: true,
    }),
    presentNotification: (payload) => {
      presented.push(payload);
      return true;
    },
    diagnosticFn: (...args) => diagnostics.push(args),
  });

  const notified = handleMentionNotification({
    id: 'message-1',
    guildId: 'guild-1',
    senderId: 'user-1',
    senderName: 'Scout',
    content: 'hey @Builder',
    mentions: [{ userId: 'user-2', label: '@Builder' }],
  }, 'guildchat:message');

  assert.equal(notified, true);
  assert.deepEqual(unreadMessages, ['message-1']);
  assert.equal(presented.length, 1);
  assert.equal(presented[0].descriptor.route.type, 'guildchat-mention');
  assert.deepEqual(diagnostics, []);
});

test('guild chat mention notification handler suppresses duplicate or foreground-visible mentions', () => {
  const diagnostics = [];
  const presented = [];

  const duplicateHandler = createGuildChatMentionNotificationHandler({
    currentGuild: 'guild-1',
    currentUserId: 'user-2',
    shouldNotifyMention: () => false,
    presentNotification: (payload) => presented.push(payload),
    diagnosticFn: (...args) => diagnostics.push(args),
  });

  const foregroundHandler = createGuildChatMentionNotificationHandler({
    currentGuild: 'guild-1',
    currentUserId: 'user-2',
    shouldNotifyMention: () => true,
    getNotificationContext: () => ({
      currentGuild: 'guild-1',
      guildChatVisible: true,
      appForegrounded: true,
    }),
    presentNotification: (payload) => presented.push(payload),
    diagnosticFn: (...args) => diagnostics.push(args),
  });

  assert.equal(duplicateHandler({
    id: 'message-2',
    guildId: 'guild-1',
    senderId: 'user-1',
    mentions: [{ userId: 'user-2', label: '@Builder' }],
  }, 'guildchat:message'), false);
  assert.equal(foregroundHandler({
    id: 'message-3',
    guildId: 'guild-1',
    senderId: 'user-1',
    mentions: [{ userId: 'user-2', label: '@Builder' }],
  }, 'guildchat:message'), false);

  assert.equal(presented.length, 0);
  assert.deepEqual(
    diagnostics.map(([, eventName, details]) => [eventName, details.reason]),
    [
      ['guildchat_mention_suppressed', 'duplicate-window'],
      ['guildchat_mention_suppressed', 'foreground-visible'],
    ]
  );
});

test('guild chat mention notification handler suppresses mentions when global chat mute is enabled', () => {
  const diagnostics = [];
  const presented = [];

  const handler = createGuildChatMentionNotificationHandler({
    currentGuild: 'guild-1',
    currentUserId: 'user-2',
    shouldNotifyMention: () => true,
    getNotificationContext: () => ({
      currentGuild: 'guild-1',
      guildChatVisible: false,
      appForegrounded: false,
      muteAll: true,
    }),
    presentNotification: (payload) => presented.push(payload),
    diagnosticFn: (...args) => diagnostics.push(args),
  });

  assert.equal(handler({
    id: 'message-4',
    guildId: 'guild-1',
    senderId: 'user-1',
    mentions: [{ userId: 'user-2', label: '@Builder' }],
  }, 'guildchat:message'), false);

  assert.equal(presented.length, 0);
  assert.deepEqual(
    diagnostics.map(([, eventName, details]) => [eventName, details.reason]),
    [
      ['guildchat_mention_suppressed', 'muted'],
    ],
  );
});
