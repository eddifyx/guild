import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGuildChatSendAction,
  emitGuildChatTypingState,
  GUILDCHAT_SEND_TIMEOUT_MS,
  GUILDCHAT_TRANSPORT_EVENT_NAMES,
  joinGuildChatSession,
} from '../../../client/src/features/messaging/guildChatTransportFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('joinGuildChatSession emits join, captures ack failures, and leaves cleanly', () => {
  const errors = createStateContainer('stale');
  const emitted = [];
  const diagnostics = [];
  const socket = {
    emit(eventName, payload, ack) {
      emitted.push([eventName, payload]);
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Denied' });
      }
    },
  };

  const cleanup = joinGuildChatSession({
    socket,
    connected: true,
    currentGuild: 'guild-1',
    canListen: true,
    setLastError: (nextValue) => errors.set(nextValue),
    diagnosticFn: (...args) => diagnostics.push(args),
  });

  cleanup();

  assert.equal(errors.value, 'Denied');
  assert.deepEqual(
    emitted,
    [
      [GUILDCHAT_TRANSPORT_EVENT_NAMES.join, { guildId: 'guild-1' }],
      [GUILDCHAT_TRANSPORT_EVENT_NAMES.leave, { guildId: 'guild-1' }],
    ]
  );
  assert.deepEqual(
    diagnostics.map(([, eventName]) => eventName),
    ['guildchat_join_requested', 'guildchat_join_ack']
  );
});

test('createGuildChatSendAction keeps optimistic state stable through a successful ack', async () => {
  const errors = createStateContainer('old error');
  const messages = createStateContainer([]);
  const emitted = [];
  const socket = {
    emit(eventName, payload, ack) {
      emitted.push([eventName, payload]);
      ack?.({ ok: true, messageId: 'server-1' });
    },
  };

  const sendMessage = createGuildChatSendAction({
    socket,
    connected: true,
    currentGuild: 'guild-1',
    currentMembers: [{ id: 'user-2', username: 'Scout' }],
    user: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
    },
    myMember: null,
    setLastError: (nextValue) => errors.set(nextValue),
    setMessages: (updater) => messages.set(updater),
    createLocalId: () => 'nonce-1',
    extractMentions: () => [{ userId: 'user-2', label: '@Scout' }],
    setTimeoutFn: () => 'timeout-1',
    clearTimeoutFn: () => {},
  });

  const messageId = await sendMessage('hello @Scout');

  assert.equal(messageId, 'server-1');
  assert.equal(errors.value, '');
  assert.deepEqual(emitted, [[GUILDCHAT_TRANSPORT_EVENT_NAMES.message, {
    guildId: 'guild-1',
    content: 'hello @Scout',
    clientNonce: 'nonce-1',
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [],
  }]]);
  assert.equal(messages.value.length, 1);
  assert.equal(messages.value[0].id, 'server-1');
  assert.equal(messages.value[0].pending, false);
  assert.equal(messages.value[0].failed, false);
});

test('createGuildChatSendAction marks optimistic sends failed when the socket ack times out', async () => {
  const errors = createStateContainer('');
  const messages = createStateContainer([]);
  let timeoutCallback = null;
  const socket = {
    emit() {},
  };

  const sendMessage = createGuildChatSendAction({
    socket,
    connected: true,
    currentGuild: 'guild-1',
    currentMembers: [],
    user: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
    },
    myMember: null,
    setLastError: (nextValue) => errors.set(nextValue),
    setMessages: (updater) => messages.set(updater),
    createLocalId: () => 'nonce-2',
    setTimeoutFn: (fn, ms) => {
      assert.equal(ms, GUILDCHAT_SEND_TIMEOUT_MS);
      timeoutCallback = fn;
      return 'timeout-2';
    },
    clearTimeoutFn: () => {},
  });

  const sendPromise = sendMessage('waiting on ack');
  timeoutCallback();

  await assert.rejects(sendPromise, /timed out/);
  assert.equal(errors.value, '/guildchat send timed out. Please try again.');
  assert.deepEqual(messages.value, [{
    id: 'nonce-2',
    clientNonce: 'nonce-2',
    guildId: 'guild-1',
    content: 'waiting on ack',
    senderId: 'user-1',
    senderName: 'Builder',
    senderColor: '#40FF40',
    senderPicture: null,
    createdAt: messages.value[0].createdAt,
    pending: false,
    failed: true,
    mentions: [],
    attachments: [],
  }]);
});

test('emitGuildChatTypingState emits the correct event only when the session is live', () => {
  const emitted = [];
  const socket = {
    emit(eventName, payload) {
      emitted.push([eventName, payload]);
    },
  };

  assert.equal(emitGuildChatTypingState({
    socket,
    connected: true,
    currentGuild: 'guild-9',
    typing: true,
  }), true);
  assert.equal(emitGuildChatTypingState({
    socket,
    connected: true,
    currentGuild: 'guild-9',
    typing: false,
  }), true);
  assert.equal(emitGuildChatTypingState({
    socket,
    connected: false,
    currentGuild: 'guild-9',
    typing: true,
  }), false);

  assert.deepEqual(emitted, [
    [GUILDCHAT_TRANSPORT_EVENT_NAMES.typingStart, { guildId: 'guild-9' }],
    [GUILDCHAT_TRANSPORT_EVENT_NAMES.typingStop, { guildId: 'guild-9' }],
  ]);
});
