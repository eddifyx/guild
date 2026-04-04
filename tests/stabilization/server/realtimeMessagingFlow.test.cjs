const test = require('node:test');
const assert = require('node:assert/strict');

const { createRealtimeMessagingFlow } = require('../../../server/src/domain/messaging/realtimeMessagingFlow');

function createHarness(overrides = {}) {
  const roomBroadcasts = [];
  const userBroadcasts = [];
  const socketRooms = [];
  const persistedRoomMessages = [];
  const persistedDirectMessages = [];
  const senderKeyWrites = [];
  const recordedMessages = [];

  const io = {
    to(room) {
      return {
        emit(event, payload) {
          if (room.startsWith('room:')) {
            roomBroadcasts.push([room, event, payload]);
          } else {
            userBroadcasts.push([room, event, payload]);
          }
        },
      };
    },
  };

  const socket = {
    join(room) {
      socketRooms.push(['join', room]);
    },
    leave(room) {
      socketRooms.push(['leave', room]);
    },
    to(room) {
      return {
        emit(event, payload) {
          roomBroadcasts.push([room, event, payload]);
        },
      };
    },
  };

  const flow = createRealtimeMessagingFlow({
    io,
    socket,
    userId: 'user-1',
    username: 'Builder',
    checkMessageRate: () => true,
    checkTypingRate: () => true,
    maxContentLength: 1024,
    maxAttachments: 10,
    isRoomMember: {
      get: (roomId, targetUserId) => (
        roomId === 'room-1' && (targetUserId === 'user-1' || targetUserId === 'user-2')
          ? { room_id: roomId, user_id: targetUserId }
          : null
      ),
    },
    getUserById: {
      get: (userId) => ({
        'user-1': {
          id: 'user-1',
          username: 'Builder',
          avatar_color: '#40FF40',
          npub: 'npub1builder',
          profile_picture: 'https://example.com/builder.png',
        },
        'user-2': {
          id: 'user-2',
          username: 'Scout',
          avatar_color: '#55AAFF',
          npub: 'npub1scout',
          profile_picture: null,
        },
      }[userId] || null),
    },
    ensureDirectMessagesAvailable: () => true,
    ensureBoardsAvailable: () => true,
    sanitizeAttachmentRefs: (attachments) => attachments || [],
    persistRoomMessage: (payload) => {
      persistedRoomMessages.push(payload);
      return [{ id: 'attachment-1' }];
    },
    persistDMMessage: (payload) => {
      persistedDirectMessages.push(payload);
      return [{ id: 'attachment-2' }];
    },
    upsertSenderKeyDistribution: {
      run: (...args) => senderKeyWrites.push(args),
    },
    buildRoomMessage: (payload) => ({ kind: 'room', ...payload }),
    buildDirectMessage: (payload) => ({ kind: 'dm', ...payload }),
    buildDirectSenderKeyPayload: (payload) => ({ kind: 'sender-key', ...payload }),
    validateDirectSenderKeyMetadata: () => ({ ok: true }),
    runtimeMetrics: {
      recordChatMessage: (...args) => recordedMessages.push(args),
    },
    uuidGenerator: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    getStoredMessageById: (messageId) => ({ created_at: `stored-${messageId}` }),
    ...overrides,
  });

  return {
    flow,
    roomBroadcasts,
    userBroadcasts,
    socketRooms,
    persistedRoomMessages,
    persistedDirectMessages,
    senderKeyWrites,
    recordedMessages,
  };
}

test('realtime messaging flow joins and leaves rooms through the socket edge', () => {
  const { flow, socketRooms, roomBroadcasts } = createHarness();
  const replies = [];

  flow.handleRoomJoin({ roomId: 'room-1' }, (payload) => replies.push(payload));
  flow.handleRoomLeave({ roomId: 'room-1' }, (payload) => replies.push(payload));

  assert.deepEqual(socketRooms, [
    ['join', 'room:room-1'],
    ['leave', 'room:room-1'],
  ]);
  assert.deepEqual(roomBroadcasts.slice(0, 2), [
    ['room:room-1', 'room:user_joined', { roomId: 'room-1', userId: 'user-1', username: 'Builder' }],
    ['room:room-1', 'room:user_left', { roomId: 'room-1', userId: 'user-1', username: 'Builder' }],
  ]);
  assert.deepEqual(replies, [{ ok: true }, { ok: true }]);
});

test('realtime messaging flow persists and emits room messages in the canonical shape', () => {
  const { flow, persistedRoomMessages, roomBroadcasts, recordedMessages } = createHarness();
  const replies = [];

  flow.handleRoomMessage({
    roomId: 'room-1',
    content: 'hello room',
    attachments: [{ fileId: 'upload-1' }],
    encrypted: false,
    clientNonce: 'nonce-1',
  }, (payload) => replies.push(payload));

  assert.deepEqual(persistedRoomMessages, [{
    msgId: 'id-1',
    roomId: 'room-1',
    content: 'hello room',
    encrypted: false,
    attachmentRefs: [{ fileId: 'upload-1' }],
  }]);
  assert.deepEqual(roomBroadcasts, [[
    'room:room-1',
    'room:message',
    {
      kind: 'room',
      messageId: 'id-1',
      roomId: 'room-1',
      content: 'hello room',
      sender: {
        id: 'user-1',
        username: 'Builder',
        avatar_color: '#40FF40',
        npub: 'npub1builder',
        profile_picture: 'https://example.com/builder.png',
      },
      senderId: 'user-1',
      attachments: [{ id: 'attachment-1' }],
      encrypted: false,
      clientNonce: 'nonce-1',
      createdAt: 'stored-id-1',
    },
  ]]);
  assert.deepEqual(recordedMessages, [['room', {
    roomId: 'room-1',
    encrypted: false,
    attachmentCount: 1,
  }]]);
  assert.deepEqual(replies, [{ ok: true, messageId: 'id-1', clientNonce: 'nonce-1' }]);
});

test('realtime messaging flow persists and emits direct messages to both participants', () => {
  const { flow, persistedDirectMessages, userBroadcasts, recordedMessages } = createHarness();
  const replies = [];

  flow.handleDirectMessage({
    toUserId: 'user-2',
    content: 'hello dm',
    attachments: [],
    encrypted: true,
    clientNonce: 'nonce-2',
  }, (payload) => replies.push(payload));

  assert.deepEqual(persistedDirectMessages, [{
    msgId: 'id-1',
    toUserId: 'user-2',
    content: 'hello dm',
    encrypted: true,
    attachmentRefs: [],
  }]);
  assert.deepEqual(userBroadcasts, [
    ['user:user-2', 'dm:message', {
      kind: 'dm',
      messageId: 'id-1',
      dmPartnerId: 'user-2',
      content: 'hello dm',
      sender: {
        id: 'user-1',
        username: 'Builder',
        avatar_color: '#40FF40',
        npub: 'npub1builder',
        profile_picture: 'https://example.com/builder.png',
      },
      senderId: 'user-1',
      attachments: [{ id: 'attachment-2' }],
      encrypted: true,
      clientNonce: 'nonce-2',
      createdAt: 'stored-id-1',
    }],
    ['user:user-1', 'dm:message', {
      kind: 'dm',
      messageId: 'id-1',
      dmPartnerId: 'user-2',
      content: 'hello dm',
      sender: {
        id: 'user-1',
        username: 'Builder',
        avatar_color: '#40FF40',
        npub: 'npub1builder',
        profile_picture: 'https://example.com/builder.png',
      },
      senderId: 'user-1',
      attachments: [{ id: 'attachment-2' }],
      encrypted: true,
      clientNonce: 'nonce-2',
      createdAt: 'stored-id-1',
    }],
  ]);
  assert.deepEqual(recordedMessages, [['dm', {
    toUserId: 'user-2',
    encrypted: true,
    attachmentCount: 1,
  }]]);
  assert.deepEqual(replies, [{ ok: true, messageId: 'id-1', clientNonce: 'nonce-2' }]);
});

test('realtime messaging flow rejects room actions when boards are disabled', () => {
  const { flow, roomBroadcasts, socketRooms, persistedRoomMessages } = createHarness({
    ensureBoardsAvailable: (ack) => {
      ack({ ok: false, error: 'Boards are temporarily disabled while we replace them.', code: 'BOARDS_DISABLED' });
      return false;
    },
  });
  const replies = [];

  flow.handleRoomJoin({ roomId: 'room-1' }, (payload) => replies.push(payload));
  flow.handleRoomMessage({ roomId: 'room-1', content: 'hello room' }, (payload) => replies.push(payload));

  assert.deepEqual(socketRooms, []);
  assert.deepEqual(roomBroadcasts, []);
  assert.deepEqual(persistedRoomMessages, []);
  assert.deepEqual(replies, [
    { ok: false, error: 'Boards are temporarily disabled while we replace them.', code: 'BOARDS_DISABLED' },
    { ok: false, error: 'Boards are temporarily disabled while we replace them.', code: 'BOARDS_DISABLED' },
  ]);
});

test('realtime messaging flow validates direct sender-key metadata before emitting', () => {
  const { flow, userBroadcasts, senderKeyWrites } = createHarness({
    validateDirectSenderKeyMetadata: () => ({ ok: false, error: 'Invalid sender key metadata' }),
  });
  const replies = [];

  flow.handleDirectSenderKey({
    toUserId: 'user-2',
    envelope: 'sealed',
    roomId: 'room-1',
    distributionId: 'distribution-1',
  }, (payload) => replies.push(payload));

  assert.deepEqual(replies, [{ ok: false, error: 'Invalid sender key metadata' }]);
  assert.deepEqual(userBroadcasts, []);
  assert.deepEqual(senderKeyWrites, []);
});

test('realtime messaging flow routes typing updates through room and direct-message surfaces', () => {
  const { flow, roomBroadcasts, userBroadcasts } = createHarness();
  const replies = [];

  flow.handleTypingStart({ roomId: 'room-1' }, (payload) => replies.push(payload));
  flow.handleTypingStop({ toUserId: 'user-2' }, (payload) => replies.push(payload));

  assert.deepEqual(roomBroadcasts, [[
    'room:room-1',
    'typing:start',
    { userId: 'user-1', username: 'Builder', roomId: 'room-1' },
  ]]);
  assert.deepEqual(userBroadcasts, [[
    'user:user-2',
    'typing:stop',
    { userId: 'user-1', username: 'Builder', toUserId: 'user-2' },
  ]]);
  assert.deepEqual(replies, [{ ok: true }, { ok: true }]);
});
