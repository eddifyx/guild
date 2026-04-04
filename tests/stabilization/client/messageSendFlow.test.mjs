import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMessageSendAction,
  DM_UNAVAILABLE_ERROR,
  MESSAGE_SEND_TIMEOUT_MS,
} from '../../../client/src/features/messaging/messageSendFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('message send flow finalizes an optimistic room message on successful ack', async () => {
  const messages = createStateContainer([]);
  const cachedStates = [];
  const persisted = [];
  const revoked = [];
  const pendingSentMessagesRef = { current: new Map() };
  const emitted = [];

  const sendMessage = createMessageSendAction({
    socket: {
      emit(eventName, payload, ack) {
        emitted.push([eventName, payload]);
        ack?.({ ok: true, messageId: 'server-room-1' });
      },
    },
    conversation: { type: 'room', id: 'room-1' },
    user: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      profilePicture: '/user.png',
      npub: 'npub-user-1',
    },
    hasMore: true,
    pendingSentMessagesRef,
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    encryptGroupMessageFn: async (roomId, content) => `enc:${roomId}:${content}`,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    createConversationTimestampFn: () => '2026-03-25 20:15:00',
    appendOrReplaceMessageFn: (existingMessages, incomingMessage) => {
      const next = [...(existingMessages || [])];
      const index = next.findIndex((message) => (
        message.id === incomingMessage.id
        || ((message.client_nonce || message._clientNonce) && (message.client_nonce || message._clientNonce) === (incomingMessage.client_nonce || incomingMessage._clientNonce))
      ));
      if (index >= 0) next[index] = incomingMessage;
      else next.push(incomingMessage);
      return next;
    },
    updateCachedConversationStateFn: (key, updater) => {
      const previous = cachedStates.at(-1)?.value || null;
      const next = updater(previous);
      cachedStates.push({ key, value: next });
      return next;
    },
    sanitizeCachedAttachmentsFn: (attachments) => attachments?.map(({ _previewUrl, ...attachment }) => attachment) || [],
    persistDecryptedMessageFn: (...args) => persisted.push(args),
    revokeAttachmentPreviewUrlsFn: (attachments) => revoked.push(attachments),
    setMessages: (updater) => messages.set(updater),
    createLocalId: () => 'nonce-room-1',
  });

  await sendMessage('hello room');

  assert.equal(pendingSentMessagesRef.current.size, 0);
  assert.deepEqual(emitted, [[
    'room:message',
    {
      roomId: 'room-1',
      content: 'enc:room-1:hello room',
      attachments: null,
      encrypted: true,
      clientNonce: 'nonce-room-1',
    },
  ]]);
  assert.equal(messages.value.length, 1);
  assert.equal(messages.value[0].id, 'server-room-1');
  assert.equal(messages.value[0]._optimistic, false);
  assert.equal(messages.value[0]._ciphertextContent, 'enc:room-1:hello room');
  assert.equal(persisted.length, 1);
  assert.equal(revoked.length, 1);
});

test('message send flow sends secure DMs through the DM socket path', async () => {
  const messages = createStateContainer([]);

  const sendMessage = createMessageSendAction({
    socket: {
      emit(eventName, payload, ack) {
        assert.equal(eventName, 'dm:message');
        assert.deepEqual(payload, {
          toUserId: 'user-2',
          content: 'enc-dm:user-2:hello dm',
          attachments: null,
          encrypted: true,
          clientNonce: 'nonce-dm-1',
        });
        ack?.({ ok: true, messageId: 'server-dm-1' });
      },
    },
    conversation: { type: 'dm', id: 'user-2', dmUnsupported: false },
    user: { userId: 'user-1', username: 'Builder' },
    pendingSentMessagesRef: { current: new Map() },
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    encryptDirectMessageFn: async (userId, content) => `enc-dm:${userId}:${content}`,
    getConversationCacheKeyFn: () => 'user-1:dm:user-2',
    appendOrReplaceMessageFn: (existingMessages, incomingMessage) => [...(existingMessages || []), incomingMessage],
    updateCachedConversationStateFn: () => {},
    sanitizeCachedAttachmentsFn: (attachments) => attachments || [],
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: (updater) => messages.set(updater),
    createLocalId: () => 'nonce-dm-1',
  });

  await sendMessage('hello dm');

  assert.equal(messages.value.at(-1).id, 'server-dm-1');
});

test('message send flow rolls back optimistic state when the socket ack fails', async () => {
  const messages = createStateContainer([]);
  const pendingSentMessagesRef = { current: new Map() };
  const cachedStates = [];

  const sendMessage = createMessageSendAction({
    socket: {
      emit(_eventName, _payload, ack) {
        ack?.({ ok: false, error: 'Denied' });
      },
    },
    conversation: { type: 'room', id: 'room-rollback' },
    user: { userId: 'user-1', username: 'Builder' },
    pendingSentMessagesRef,
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    encryptGroupMessageFn: async () => 'enc:rollback',
    getConversationCacheKeyFn: () => 'user-1:room:room-rollback',
    appendOrReplaceMessageFn: (existingMessages, incomingMessage) => [...(existingMessages || []), incomingMessage],
    updateCachedConversationStateFn: (_key, updater) => {
      const previous = cachedStates.at(-1)?.value || null;
      const next = updater(previous);
      cachedStates.push({ value: next });
      return next;
    },
    sanitizeCachedAttachmentsFn: (attachments) => attachments || [],
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: (updater) => messages.set(updater),
    createLocalId: () => 'nonce-rollback',
  });

  await assert.rejects(() => sendMessage('rollback me'), /Denied/);
  assert.equal(pendingSentMessagesRef.current.size, 0);
  assert.deepEqual(messages.value, []);
});

test('message send flow rejects unsupported DM and missing secure prerequisites', async () => {
  const sendUnsupportedDm = createMessageSendAction({
    socket: { emit() {} },
    conversation: { type: 'dm', id: 'user-2', dmUnsupported: true },
    user: { userId: 'user-1' },
    pendingSentMessagesRef: { current: new Map() },
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    getConversationCacheKeyFn: () => null,
    appendOrReplaceMessageFn: (messages) => messages || [],
    updateCachedConversationStateFn: () => {},
    sanitizeCachedAttachmentsFn: (attachments) => attachments || [],
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: () => {},
  });

  await assert.rejects(() => sendUnsupportedDm('blocked'), new RegExp(DM_UNAVAILABLE_ERROR));

  const sendWithoutSecureStartup = createMessageSendAction({
    socket: { emit() {} },
    conversation: { type: 'room', id: 'room-1' },
    user: { userId: 'user-1' },
    pendingSentMessagesRef: { current: new Map() },
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => false,
    hasKnownNpubFn: () => true,
    getConversationCacheKeyFn: () => null,
    appendOrReplaceMessageFn: (messages) => messages || [],
    updateCachedConversationStateFn: () => {},
    sanitizeCachedAttachmentsFn: (attachments) => attachments || [],
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: () => {},
  });

  await assert.rejects(() => sendWithoutSecureStartup('blocked'), /secure startup succeeds/);
});

test('message send flow uses the shared send timeout when an ack never arrives', async () => {
  let timeoutCallback = null;

  const sendMessage = createMessageSendAction({
    socket: {
      emit() {},
    },
    conversation: { type: 'room', id: 'room-timeout' },
    user: { userId: 'user-1' },
    pendingSentMessagesRef: { current: new Map() },
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    encryptGroupMessageFn: async () => 'enc:timeout',
    getConversationCacheKeyFn: () => 'user-1:room:room-timeout',
    appendOrReplaceMessageFn: (existingMessages, incomingMessage) => [...(existingMessages || []), incomingMessage],
    updateCachedConversationStateFn: () => {},
    sanitizeCachedAttachmentsFn: (attachments) => attachments || [],
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: () => {},
    setTimeoutFn: (fn, delayMs) => {
      assert.equal(delayMs, MESSAGE_SEND_TIMEOUT_MS);
      timeoutCallback = fn;
      return 'timeout-id';
    },
    clearTimeoutFn: () => {},
  });

  const sendPromise = sendMessage('hello timeout');
  await Promise.resolve();
  timeoutCallback();
  await assert.rejects(sendPromise, /timed out/);
});
