import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildChatAttachmentRequestPayload,
  buildOptimisticGuildChatMessage,
  createLocalGuildChatId,
  guildChatMessageMentionsUser,
  markGuildChatMessageFailed,
  markGuildChatMessageSent,
  mergeGuildChatAttachments,
  mergeGuildChatMessage,
  shouldRecordGuildChatMentionNotification,
  trimLiveGuildChatMessages,
  updateGuildChatMessage,
} from '../../../client/src/features/messaging/guildChatState.mjs';

test('trimLiveGuildChatMessages keeps only the newest messages past the live cap', () => {
  assert.deepEqual(
    trimLiveGuildChatMessages([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2),
    [{ id: 'b' }, { id: 'c' }]
  );
});

test('mergeGuildChatAttachments preserves preview urls from matching optimistic attachments', () => {
  assert.deepEqual(
    mergeGuildChatAttachments(
      [{ id: 'attachment-1', _previewUrl: 'blob:preview-1' }],
      [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }]
    ),
    [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1', _previewUrl: 'blob:preview-1' }]
  );
});

test('mergeGuildChatMessage reconciles optimistic and acked messages by client nonce', () => {
  const next = mergeGuildChatMessage([{
    id: 'local-1',
    clientNonce: 'nonce-1',
    pending: true,
    attachments: [{ id: 'attachment-1', _previewUrl: 'blob:preview-1' }],
  }], {
    id: 'server-1',
    clientNonce: 'nonce-1',
    attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1' }],
  });

  assert.deepEqual(next, [{
    id: 'server-1',
    clientNonce: 'nonce-1',
    pending: false,
    failed: false,
    attachments: [{ id: 'attachment-1', fileUrl: '/api/files/attachment-1', _previewUrl: 'blob:preview-1' }],
  }]);
});

test('buildOptimisticGuildChatMessage shapes local sends consistently', () => {
  assert.deepEqual(buildOptimisticGuildChatMessage({
    guildId: 'guild-1',
    content: 'hello',
    user: {
      userId: 'user-1',
      username: 'Builder',
      avatarColor: '#40FF40',
      profilePicture: 'https://example.com/builder.png',
    },
    myMember: null,
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [{
      fileId: 'upload-1',
      fileUrl: '/api/files/upload-1',
      fileName: 'proof.png',
      fileType: 'image/png',
      fileSize: 1024,
      _originalName: 'proof.png',
      _originalType: 'image/png',
      _originalSize: 1024,
      _encryptionKey: 'key',
      _encryptionDigest: 'digest',
      _previewUrl: 'blob:preview-1',
    }],
    clientNonce: 'nonce-1',
    createLocalId: () => 'attachment-local-1',
    nowIso: () => '2026-03-24T21:00:00.000Z',
  }), {
    id: 'nonce-1',
    clientNonce: 'nonce-1',
    guildId: 'guild-1',
    content: 'hello',
    senderId: 'user-1',
    senderName: 'Builder',
    senderColor: '#40FF40',
    senderPicture: 'https://example.com/builder.png',
    createdAt: '2026-03-24T21:00:00.000Z',
    pending: true,
    failed: false,
    mentions: [{ userId: 'user-2', label: '@Scout' }],
    attachments: [{
      id: 'upload-1',
      fileUrl: '/api/files/upload-1',
      serverFileUrl: '/api/files/upload-1',
      fileName: 'proof.png',
      fileType: 'image/png',
      fileSize: 1024,
      originalFileName: 'proof.png',
      originalFileType: 'image/png',
      originalFileSize: 1024,
      encryptionKey: 'key',
      encryptionDigest: 'digest',
      _previewUrl: 'blob:preview-1',
    }],
  });
});

test('buildGuildChatAttachmentRequestPayload and ack markers keep send state stable', () => {
  assert.deepEqual(buildGuildChatAttachmentRequestPayload([{
    fileId: 'upload-1',
    _encryptionKey: 'key',
    _encryptionDigest: 'digest',
    _originalName: 'proof.png',
    _originalType: 'image/png',
    _originalSize: 1024,
  }]), [{
    fileId: 'upload-1',
    encryptionKey: 'key',
    encryptionDigest: 'digest',
    originalFileName: 'proof.png',
    originalFileType: 'image/png',
    originalFileSize: 1024,
  }]);

  assert.deepEqual(
    markGuildChatMessageFailed([{ clientNonce: 'nonce-1', pending: true, failed: false }], 'nonce-1'),
    [{ clientNonce: 'nonce-1', pending: false, failed: true }]
  );
  assert.deepEqual(
    markGuildChatMessageSent([{ id: 'local-1', clientNonce: 'nonce-1', pending: true }], 'nonce-1', 'server-1'),
    [{ id: 'server-1', clientNonce: 'nonce-1', pending: false }]
  );
});

test('guildChat mention helpers dedupe recent notifications and detect self-mentions', () => {
  const cache = new Map([['old-message', 0]]);

  assert.equal(
    shouldRecordGuildChatMentionNotification(cache, 'message-1', { now: 31_000, ttlMs: 30_000 }),
    true
  );
  assert.equal(
    shouldRecordGuildChatMentionNotification(cache, 'message-1', { now: 31_500, ttlMs: 30_000 }),
    false
  );
  assert.equal(
    guildChatMessageMentionsUser({ mentions: [{ userId: 'user-2' }] }, 'user-2'),
    true
  );
  assert.deepEqual(
    updateGuildChatMessage([{ id: 'message-1', content: 'before' }], 'message-1', (message) => ({ ...message, content: 'after' })),
    [{ id: 'message-1', content: 'after' }]
  );
  assert.ok(createLocalGuildChatId({ cryptoObject: { randomUUID: () => 'uuid-1' } }).startsWith('uuid-1'));
});
