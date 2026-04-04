const test = require('node:test');
const assert = require('node:assert/strict');

const { createGuildChatFlow } = require('../../../server/src/domain/messaging/guildChatFlow');

function createHarness(overrides = {}) {
  const roomJoins = [];
  const roomLeaves = [];
  const broadcasts = [];
  const runtimeEvents = [];
  const runtimeMessages = [];
  const trackedAttachments = [];
  const claimedAttachments = [];
  const cancelledGuilds = [];
  const scheduledGuilds = [];
  const joinedGuildChats = new Set();

  const socket = {
    join(room) {
      roomJoins.push(room);
    },
    leave(room) {
      roomLeaves.push(room);
    },
    to(room) {
      return {
        emit(event, payload) {
          broadcasts.push([room, event, payload]);
        },
      };
    },
  };

  const io = {
    to(room) {
      return {
        emit(event, payload) {
          broadcasts.push([room, event, payload]);
        },
      };
    },
  };

  const flow = createGuildChatFlow({
    io,
    socket,
    userId: 'user-1',
    username: 'Builder',
    joinedGuildChats,
    guildChatRoom: (guildId) => `guildchat:${guildId}`,
    cancelGuildChatCleanup: (guildId) => cancelledGuilds.push(guildId),
    scheduleGuildChatCleanup: (_io, guildId) => scheduledGuilds.push(guildId),
    rejectInvalidGuildChatPayload: (_eventName, validation, ack) => ack({ ok: false, error: validation.error }),
    validateGuildChatGuildPayload: (payload) => ({ ok: true, value: payload }),
    validateGuildChatMessagePayload: (payload) => ({ ok: true, value: payload }),
    getGuildMemberWithPerms: () => ({
      guild_id: 'guild-1',
      rank_order: 4,
      permissions: {
        guild_chat_listen: true,
        guild_chat_speak: true,
      },
    }),
    ensureGuildChatPermission: () => true,
    checkMessageRate: () => true,
    checkTypingRate: () => true,
    maxAttachments: 10,
    maxContentLength: 1024,
    sanitizeGuildChatAttachmentRefs: (attachments) => attachments || [],
    getGuildMembers: {
      all: () => [
        { id: 'user-1', username: 'Builder' },
        { id: 'user-2', username: 'Scout' },
      ],
    },
    resolveEffectiveGuildChatMentions: () => ({
      ok: true,
      normalizedContent: 'hello @Scout',
      effectiveMentions: [{ userId: 'user-2', label: '@Scout' }],
      extractedMentionCount: 1,
      requestedMentionCount: 1,
      effectiveMentionCount: 1,
      wasPruned: false,
    }),
    getUserById: {
      get: () => ({
        username: 'Builder',
        avatar_color: '#40FF40',
        profile_picture: 'https://example.com/builder.png',
        npub: 'npub1builder',
      }),
    },
    claimGuildChatAttachments: (...args) => {
      claimedAttachments.push(args);
      return [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }];
    },
    buildGuildChatMessage: (payload) => ({ id: payload.messageId, guildId: payload.guildId, mentions: payload.mentions, attachments: payload.attachments }),
    trackGuildChatAttachments: (...args) => trackedAttachments.push(args),
    listGuildChatMentionRecipients: () => ['user-2'],
    runtimeMetrics: {
      recordChatEvent: (event, payload) => runtimeEvents.push([event, payload]),
      recordChatMessage: (kind, payload) => runtimeMessages.push([kind, payload]),
    },
    createMessageId: () => 'message-1',
    ...overrides,
  });

  return {
    flow,
    joinedGuildChats,
    roomJoins,
    roomLeaves,
    broadcasts,
    runtimeEvents,
    runtimeMessages,
    trackedAttachments,
    claimedAttachments,
    cancelledGuilds,
    scheduledGuilds,
  };
}

test('guild chat flow joins and leaves guild chat rooms while tracking cleanup state', () => {
  const { flow, joinedGuildChats, roomJoins, roomLeaves, cancelledGuilds, scheduledGuilds } = createHarness();
  const replies = [];

  flow.handleJoin({ guildId: 'guild-1' }, (payload) => replies.push(payload));
  flow.handleLeave({ guildId: 'guild-1' }, (payload) => replies.push(payload));

  assert.deepEqual(roomJoins, ['guildchat:guild-1']);
  assert.deepEqual(roomLeaves, ['guildchat:guild-1']);
  assert.deepEqual(cancelledGuilds, ['guild-1']);
  assert.deepEqual(scheduledGuilds, ['guild-1']);
  assert.equal(joinedGuildChats.size, 0);
  assert.deepEqual(replies, [{ ok: true }, { ok: true }]);
});

test('guild chat flow emits messages and routed mention notifications from the server-owned mention list', () => {
  const { flow, broadcasts, runtimeEvents, runtimeMessages, trackedAttachments, claimedAttachments } = createHarness();
  const replies = [];

  flow.handleMessage({
    guildId: 'guild-1',
    content: 'hello @Scout',
    attachments: [],
    clientNonce: 'nonce-1',
    mentions: [{ userId: 'user-2', label: '@Scout' }],
  }, (payload) => replies.push(payload));

  assert.deepEqual(claimedAttachments, [['message-1', 'guild-1', []]]);
  assert.deepEqual(trackedAttachments, [['guild-1', 'message-1', [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }]]]);
  assert.deepEqual(broadcasts, [
    ['guildchat:guild-1', 'guildchat:message', {
      id: 'message-1',
      guildId: 'guild-1',
      mentions: [{ userId: 'user-2', label: '@Scout' }],
      attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }],
    }],
    ['user:user-2', 'guildchat:mention', {
      message: {
        id: 'message-1',
        guildId: 'guild-1',
        mentions: [{ userId: 'user-2', label: '@Scout' }],
        attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }],
      },
    }],
  ]);
  assert.deepEqual(runtimeEvents, [[
    'guildchat:mention_emitted',
    {
      guildId: 'guild-1',
      messageId: 'message-1',
      fromUserId: 'user-1',
      targetUserId: 'user-2',
    },
  ]]);
  assert.deepEqual(runtimeMessages, [['guildchat', {
    guildId: 'guild-1',
    encrypted: false,
    attachmentCount: 1,
  }]]);
  assert.deepEqual(replies, [{ ok: true, messageId: 'message-1', clientNonce: 'nonce-1' }]);
});

test('guild chat flow emits typing state through the guild chat room', () => {
  const { flow, broadcasts } = createHarness();
  const replies = [];

  flow.handleTypingStart({ guildId: 'guild-1' }, (payload) => replies.push(payload));
  flow.handleTypingStop({ guildId: 'guild-1' }, (payload) => replies.push(payload));

  assert.deepEqual(broadcasts, [
    ['guildchat:guild-1', 'guildchat:typing:start', { guildId: 'guild-1', userId: 'user-1', username: 'Builder' }],
    ['guildchat:guild-1', 'guildchat:typing:stop', { guildId: 'guild-1', userId: 'user-1', username: 'Builder' }],
  ]);
  assert.deepEqual(replies, [{ ok: true }, { ok: true }]);
});

test('guild chat flow disconnect schedules cleanup for all joined guild chats', () => {
  const { flow, joinedGuildChats, scheduledGuilds } = createHarness();
  joinedGuildChats.add('guild-1');
  joinedGuildChats.add('guild-2');

  flow.handleDisconnect();

  assert.deepEqual(scheduledGuilds.sort(), ['guild-1', 'guild-2']);
  assert.equal(joinedGuildChats.size, 0);
});
