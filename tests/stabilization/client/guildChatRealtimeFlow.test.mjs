import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGuildChatRealtimeHandlers,
  GUILDCHAT_REALTIME_EVENT_NAMES,
  registerGuildChatRealtimeSubscriptions,
} from '../../../client/src/features/messaging/guildChatRealtimeFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('guild chat realtime message handler merges messages and dispatches mention notifications', () => {
  const messages = createStateContainer([{
    id: 'local-1',
    clientNonce: 'nonce-1',
    pending: true,
    attachments: [{ id: 'attachment-1', _previewUrl: 'blob:preview-1' }],
  }]);
  const mentionEvents = [];

  const handlers = createGuildChatRealtimeHandlers({
    currentGuild: 'guild-1',
    currentUserId: 'user-2',
    setMessages: (updater) => messages.set(updater),
    setTypingUsers: () => {},
    setMotdText: () => {},
    clearTypingTimeout: () => {},
    typingTimeouts: new Map(),
    handleMentionNotification: (...args) => mentionEvents.push(args),
  });

  handlers.onGuildChatMessage({
    id: 'server-1',
    clientNonce: 'nonce-1',
    guildId: 'guild-1',
    senderId: 'user-1',
    content: 'hey @Scout',
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }],
  });

  assert.deepEqual(messages.value, [{
    id: 'server-1',
    clientNonce: 'nonce-1',
    guildId: 'guild-1',
    senderId: 'user-1',
    content: 'hey @Scout',
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1', _previewUrl: 'blob:preview-1' }],
    pending: false,
    failed: false,
  }]);
  assert.deepEqual(mentionEvents, [[{
    id: 'server-1',
    clientNonce: 'nonce-1',
    guildId: 'guild-1',
    senderId: 'user-1',
    content: 'hey @Scout',
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }],
  }, 'guildchat:message']]);
});

test('guild chat realtime edit, typing, and motd handlers update lane state deterministically', () => {
  const messages = createStateContainer([{ id: 'message-1', guildId: 'guild-1', content: 'before', mentions: [] }]);
  const typingUsers = createStateContainer({});
  const motdText = createStateContainer('');
  const typingTimeouts = new Map();
  const clearedUsers = [];
  let scheduledTimeout = null;

  const clearTypingTimeout = (userId) => {
    clearedUsers.push(userId);
    typingTimeouts.delete(userId);
  };

  const handlers = createGuildChatRealtimeHandlers({
    currentGuild: 'guild-1',
    currentUserId: 'user-9',
    setMessages: (updater) => messages.set(updater),
    setTypingUsers: (updater) => typingUsers.set(updater),
    setMotdText: (nextValue) => motdText.set(nextValue),
    clearTypingTimeout,
    typingTimeouts,
    handleMentionNotification: () => {},
    setTimeoutFn: (fn, ms) => {
      scheduledTimeout = { fn, ms };
      return 'timeout-1';
    },
  });

  handlers.onGuildChatMessageEdited({
    guildId: 'guild-1',
    messageId: 'message-1',
    content: 'after',
    mentions: [{ userId: 'user-3' }],
    editedAt: '2026-03-24T21:00:00.000Z',
  });
  handlers.onTypingStart({
    guildId: 'guild-1',
    userId: 'user-3',
    username: 'Scout',
  });
  handlers.onMotdUpdated({
    guildId: 'guild-1',
    motd: 'stay humble',
  });

  assert.deepEqual(messages.value, [{
    id: 'message-1',
    guildId: 'guild-1',
    content: 'after',
    mentions: [{ userId: 'user-3' }],
    editedAt: '2026-03-24T21:00:00.000Z',
  }]);
  assert.deepEqual(typingUsers.value, { 'user-3': 'Scout' });
  assert.deepEqual(motdText.value, 'stay humble');
  assert.equal(typingTimeouts.get('user-3'), 'timeout-1');
  assert.equal(scheduledTimeout.ms, 3500);

  scheduledTimeout.fn();
  assert.deepEqual(typingUsers.value, {});
  assert.equal(typingTimeouts.has('user-3'), false);

  handlers.onTypingStop({
    guildId: 'guild-1',
    userId: 'user-4',
  });
  assert.deepEqual(clearedUsers, ['user-3', 'user-4']);
});

test('guild chat realtime subscription registration binds and unbinds the canonical socket events', () => {
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
    onGuildChatMessage() {},
    onGuildChatMention() {},
    onGuildChatMessageEdited() {},
    onTypingStart() {},
    onTypingStop() {},
    onMotdUpdated() {},
  };

  const unsubscribe = registerGuildChatRealtimeSubscriptions(socket, handlers);
  unsubscribe();

  assert.deepEqual(
    calls.map(([method, eventName]) => [method, eventName]),
    [
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.message],
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.mention],
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.messageEdited],
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.typingStart],
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.typingStop],
      ['on', GUILDCHAT_REALTIME_EVENT_NAMES.motdUpdated],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.message],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.mention],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.messageEdited],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.typingStart],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.typingStop],
      ['off', GUILDCHAT_REALTIME_EVENT_NAMES.motdUpdated],
    ]
  );
});
