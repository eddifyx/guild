const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const {
  db,
  insertMessage, insertEncryptedMessage, insertAttachment, getUserById,
  ensureDMConversation, deleteDMConversation, isRoomMember, usersShareGuild,
  isGuildMember, getGuildMembers,
  getMessageById, updateMessageContent, deleteMessage,
  deleteMessageAttachments, getMessageAttachments,
  getUploadedFileById, getOwnedUnclaimedUploadedFile, getUploadedFilesByMessageId,
  claimUploadedFileForRoomMessage, claimUploadedFileForDMMessage, claimUploadedFileForGuildChatMessage,
  deleteUploadedFileRecord, upsertSenderKeyDistribution,
} = require('../db');
const { ERROR_CODES } = require('../contracts/errorCodes');
const { buildGuildMemberState } = require('../domain/guild/capabilities');
const {
  buildGuildChatMessage,
  getGuildChatPermissionFailure,
  listGuildChatMentionRecipients,
  resolveEffectiveGuildChatMentions,
} = require('../domain/messaging/guildChat');
const {
  DM_UNAVAILABLE_ERROR,
  buildDirectMessage,
  buildDirectSenderKeyPayload,
  buildRoomMessage,
  canUsersDirectMessage,
  getDirectMessageAvailabilityFailure,
  validateDirectSenderKeyMetadata,
} = require('../domain/messaging/directMessages');
const { createGuildChatFlow } = require('../domain/messaging/guildChatFlow');
const { createGuildChatRuntimeFlow } = require('../domain/messaging/guildChatRuntimeFlow');
const { getBoardsAvailabilityFailure } = require('../domain/messaging/boardAvailability');
const { createMessageAttachmentFlow } = require('../domain/messaging/messageAttachmentFlow');
const { createMessageLifecycleFlow } = require('../domain/messaging/messageLifecycleFlow');
const { createMessagePersistenceFlow } = require('../domain/messaging/messagePersistenceFlow');
const { createRealtimeMessagingFlow } = require('../domain/messaging/realtimeMessagingFlow');
const {
  validateGuildChatGuildPayload,
  validateGuildChatMessagePayload,
} = require('./validators/guildChatPayloads');
const runtimeMetrics = require('../monitoring/runtimeMetrics');

const MAX_ATTACHMENTS = 10;
const MAX_CONTENT_LENGTH = 64 * 1024; // 64KB max message content
const MAX_ATTACHMENT_FILESIZE = 100 * 1024 * 1024; // 100MB, matches encrypted upload limit
const MAX_GUILDCHAT_FILESIZE = 25 * 1024 * 1024; // 25MB
const MAX_LIVE_GUILDCHAT_MESSAGES = 200;
const UPLOAD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const SOCKET_RL_WINDOW = 10000;
const SOCKET_RL_MAX_MESSAGES = 30;
const SOCKET_RL_MAX_TYPING = 10;
const GUILDCHAT_RUNTIME_GRACE_MS = 60 * 1000;
const guildChatRoom = (guildId) => `guildchat:${guildId}`;

const guildChatRuntimeFlow = createGuildChatRuntimeFlow({
  deleteUploadedFileRecord,
  unlinkStoredFile: (storedName) => {
    fs.unlinkSync(path.join(__dirname, '..', '..', 'uploads', path.basename(storedName)));
  },
  maxLiveMessages: MAX_LIVE_GUILDCHAT_MESSAGES,
  graceMs: GUILDCHAT_RUNTIME_GRACE_MS,
});

function handleChat(io, socket) {
  const { userId, username } = socket.handshake.auth;
  const joinedGuildChats = new Set();

  const _rl = { messages: { count: 0, reset: Date.now() + SOCKET_RL_WINDOW }, typing: { count: 0, reset: Date.now() + SOCKET_RL_WINDOW } };
  function checkRate(bucket, max) {
    const now = Date.now();
    if (now >= bucket.reset) { bucket.count = 0; bucket.reset = now + SOCKET_RL_WINDOW; }
    bucket.count++;
    return bucket.count <= max;
  }

  function canUseDirectMessages(otherUserId) {
    return canUsersDirectMessage(usersShareGuild.get(userId, otherUserId));
  }

  function ensureDirectMessagesAvailable(otherUserId, ack) {
    const availability = getDirectMessageAvailabilityFailure(canUseDirectMessages(otherUserId));
    if (availability.ok) {
      return true;
    }
    ack({ ok: false, error: availability.error || DM_UNAVAILABLE_ERROR });
    return false;
  }

  function ensureBoardsAvailable(ack) {
    const availability = getBoardsAvailabilityFailure();
    if (availability.ok) {
      return true;
    }
    ack({ ok: false, error: availability.error, code: availability.code });
    return false;
  }

  function getGuildMemberWithPerms(guildId, targetUserId = userId) {
    return buildGuildMemberState(isGuildMember.get(guildId, targetUserId));
  }

  function ensureGuildChatPermission(member, permKey, ack, errorMessage) {
    const permissionCheck = getGuildChatPermissionFailure(member, permKey);
    if (permissionCheck.ok) {
      return true;
    }
    runtimeMetrics.recordChatEvent('guildchat:permission_denied', {
      userId,
      guildId: member?.guild_id || null,
      permissionKey: permKey,
      code: permissionCheck.code || ERROR_CODES.GUILD_PERMISSION_DENIED,
    });
    ack({
      ok: false,
      error: permissionCheck.error || errorMessage,
      code: permissionCheck.code || ERROR_CODES.GUILD_PERMISSION_DENIED,
    });
    return false;
  }

  function rejectInvalidGuildChatPayload(eventName, validation, ack) {
    runtimeMetrics.recordChatEvent('guildchat:invalid_payload', {
      userId,
      event: eventName,
      guildId: validation?.value?.guildId || null,
      code: validation?.code || ERROR_CODES.INVALID_GUILDCHAT_PAYLOAD,
      reason: validation?.error || 'Invalid payload',
    });
    ack({
      ok: false,
      error: validation?.error || 'Invalid payload',
      code: validation?.code || ERROR_CODES.INVALID_GUILDCHAT_PAYLOAD,
    });
  }

  function safe(handler) {
    return (data, ack) => {
      const done = typeof ack === 'function' ? ack : () => {};
      try {
        if (!data || typeof data !== 'object') {
          done({ ok: false, error: 'Invalid payload' });
          return;
        }
        handler(data, done);
      } catch (err) {
        console.error(`Socket handler error [${userId}]:`, err);
        runtimeMetrics.recordChatError('socket_handler_exception', {
          userId,
          message: err.message,
        });
        done({ ok: false, error: 'Internal server error' });
      }
    };
  }

  const messageAttachmentFlow = createMessageAttachmentFlow({
    userId,
    maxAttachments: MAX_ATTACHMENTS,
    maxAttachmentFileSize: MAX_ATTACHMENT_FILESIZE,
    maxGuildChatFileSize: MAX_GUILDCHAT_FILESIZE,
    uploadIdPattern: UPLOAD_ID_PATTERN,
    uuidGenerator: uuidv4,
    getOwnedUnclaimedUploadedFile,
    claimUploadedFileForRoomMessage,
    claimUploadedFileForDMMessage,
    claimUploadedFileForGuildChatMessage,
    insertAttachment,
  });

  const messagePersistenceFlow = createMessagePersistenceFlow({
    db,
    userId,
    insertMessage,
    insertEncryptedMessage,
    ensureDMConversation,
    deleteMessageAttachments,
    deleteUploadedFileRecord,
    deleteMessage,
    claimUploadedAttachments: messageAttachmentFlow.claimUploadedAttachments,
  });

  const realtimeMessagingFlow = createRealtimeMessagingFlow({
    io,
    socket,
    userId,
    username,
    checkMessageRate: () => checkRate(_rl.messages, SOCKET_RL_MAX_MESSAGES),
    checkTypingRate: () => checkRate(_rl.typing, SOCKET_RL_MAX_TYPING),
    maxContentLength: MAX_CONTENT_LENGTH,
    maxAttachments: MAX_ATTACHMENTS,
    isRoomMember,
    getUserById,
    ensureDirectMessagesAvailable,
    ensureBoardsAvailable,
    sanitizeAttachmentRefs: messageAttachmentFlow.sanitizeAttachmentRefs,
    persistRoomMessage: messagePersistenceFlow.persistRoomMessage,
    persistDMMessage: messagePersistenceFlow.persistDirectMessage,
    upsertSenderKeyDistribution,
    buildRoomMessage,
    buildDirectMessage,
    buildDirectSenderKeyPayload,
    validateDirectSenderKeyMetadata,
    runtimeMetrics,
    uuidGenerator: uuidv4,
    getStoredMessageById: (messageId) => getMessageById.get(messageId),
  });

  const guildChatFlow = createGuildChatFlow({
    io,
    socket,
    userId,
    username,
    joinedGuildChats,
    guildChatRoom,
    cancelGuildChatCleanup: guildChatRuntimeFlow.cancelCleanup,
    scheduleGuildChatCleanup: (targetIo, guildId) => guildChatRuntimeFlow.scheduleCleanup(targetIo, guildId, guildChatRoom),
    rejectInvalidGuildChatPayload,
    validateGuildChatGuildPayload,
    validateGuildChatMessagePayload,
    getGuildMemberWithPerms,
    ensureGuildChatPermission,
    checkMessageRate: () => checkRate(_rl.messages, SOCKET_RL_MAX_MESSAGES),
    checkTypingRate: () => checkRate(_rl.typing, SOCKET_RL_MAX_TYPING),
    maxAttachments: MAX_ATTACHMENTS,
    maxContentLength: MAX_CONTENT_LENGTH,
    sanitizeGuildChatAttachmentRefs: messageAttachmentFlow.sanitizeGuildChatAttachmentRefs,
    getGuildMembers,
    resolveEffectiveGuildChatMentions,
    getUserById,
    claimGuildChatAttachments: messageAttachmentFlow.claimGuildChatAttachments,
    buildGuildChatMessage,
    trackGuildChatAttachments: guildChatRuntimeFlow.trackAttachments,
    listGuildChatMentionRecipients,
    runtimeMetrics,
    createMessageId: uuidv4,
  });

  const messageLifecycleFlow = createMessageLifecycleFlow({
    io,
    userId,
    maxContentLength: MAX_CONTENT_LENGTH,
    getMessageById,
    updateMessageContent,
    getMessageAttachments,
    getUploadedFilesByMessageId,
    deleteMessageWithUploads: messagePersistenceFlow.deleteMessageWithUploads,
    deleteDMConversation,
    buildUploadFilePath: (rawPath) => path.join(__dirname, '..', '..', 'uploads', path.basename(rawPath)),
    unlinkFile: (filePath) => fs.unlink(filePath, () => {}),
  });

  socket.on('room:join', safe(realtimeMessagingFlow.handleRoomJoin));
  socket.on('room:leave', safe(realtimeMessagingFlow.handleRoomLeave));
  socket.on('room:message', safe(realtimeMessagingFlow.handleRoomMessage));
  socket.on('dm:message', safe(realtimeMessagingFlow.handleDirectMessage));
  socket.on('dm:sender_key', safe(realtimeMessagingFlow.handleDirectSenderKey));
  socket.on('room:request_sender_key', safe(realtimeMessagingFlow.handleRoomRequestSenderKey));

  socket.on('guildchat:join', safe(guildChatFlow.handleJoin));
  socket.on('guildchat:leave', safe(guildChatFlow.handleLeave));
  socket.on('guildchat:message', safe(guildChatFlow.handleMessage));
  socket.on('guildchat:typing:start', safe(guildChatFlow.handleTypingStart));
  socket.on('guildchat:typing:stop', safe(guildChatFlow.handleTypingStop));

  socket.on('disconnect', guildChatFlow.handleDisconnect);

  socket.on('message:edit', safe(messageLifecycleFlow.handleEdit));
  socket.on('message:delete', safe(messageLifecycleFlow.handleDelete));
  socket.on('dm:conversation:delete', safe(messageLifecycleFlow.handleDeleteConversation));

  socket.on('typing:start', safe(realtimeMessagingFlow.handleTypingStart));
  socket.on('typing:stop', safe(realtimeMessagingFlow.handleTypingStop));
}

module.exports = { handleChat };
