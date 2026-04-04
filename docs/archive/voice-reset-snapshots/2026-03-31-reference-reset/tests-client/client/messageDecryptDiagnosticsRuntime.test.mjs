import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActiveConversationDecryptSnapshot,
  installMessageDecryptDebugSurface,
  parseMessageDecryptDebugLogLines,
  readMessageDecryptElectronLog,
  readMessageDecryptDiagnostics,
  summarizeMessageDecryptDiagnostics,
} from '../../../client/src/features/messaging/messageDecryptDiagnosticsRuntime.mjs';

test('message decrypt diagnostics runtime builds sanitized active conversation snapshots without message contents', () => {
  const snapshot = buildActiveConversationDecryptSnapshot({
    conversation: { id: 'dm-2', type: 'dm' },
    userId: 'self-1',
    messages: [
      {
        id: 'msg-1',
        encrypted: true,
        sender_id: 'dm-2',
        dm_partner_id: 'self-1',
        _decryptionPending: true,
        _decryptionPendingSince: 900,
        _decryptionBucket: 'missing-session',
        content: 'ciphertext',
      },
      {
        id: 'msg-2',
        encrypted: true,
        sender_id: 'self-1',
        dm_partner_id: 'dm-2',
        _decryptionFailed: true,
        _decryptionBucket: 'missing-dm-copy',
        content: 'ciphertext',
      },
      {
        id: 'msg-3',
        encrypted: true,
        sender_id: 'other-user',
        dm_partner_id: 'self-1',
        _decryptionFailed: true,
        _decryptionBucket: 'missing-session',
      },
    ],
    nowFn: () => 1000,
  });

  assert.deepEqual(snapshot.conversation, {
    id: 'dm-2',
    type: 'dm',
  });
  assert.equal(snapshot.pendingCount, 1);
  assert.equal(snapshot.failedCount, 1);
  assert.deepEqual(snapshot.bucketCounts, {
    'missing-session': 1,
    'missing-dm-copy': 1,
  });
  assert.deepEqual(snapshot.messages, [
    {
      messageId: 'msg-1',
      route: 'dm',
      state: 'pending',
      bucket: 'missing-session',
      roomId: null,
      senderUserId: 'dm-2',
      dmPartnerId: 'self-1',
      pendingMs: 100,
    },
    {
      messageId: 'msg-2',
      route: 'dm',
      state: 'failed',
      bucket: 'missing-dm-copy',
      roomId: null,
      senderUserId: 'self-1',
      dmPartnerId: 'dm-2',
      pendingMs: null,
    },
  ]);
  assert.equal(JSON.stringify(snapshot).includes('ciphertext'), false);
});

test('message decrypt diagnostics runtime filters and summarizes bucketed lane entries', () => {
  const diagnostics = [
    {
      lane: 'voice',
      event: 'join_requested',
      details: {},
    },
    {
      lane: 'message-decrypt',
      event: 'conversation-decrypt-pending',
      details: {
        bucket: 'missing-session',
      },
    },
    {
      lane: 'message-decrypt',
      event: 'conversation-decrypt-recovered',
      details: {
        bucket: 'missing-session',
        recoveredVia: 'signal-session-ready',
      },
    },
    {
      lane: 'message-decrypt',
      event: 'conversation-decrypt-failed',
      details: {
        bucket: 'missing-dm-copy',
      },
    },
  ];

  assert.deepEqual(readMessageDecryptDiagnostics({ diagnostics }), diagnostics.slice(1));
  assert.deepEqual(summarizeMessageDecryptDiagnostics({ diagnostics }), {
    total: 3,
    byEvent: {
      'conversation-decrypt-pending': 1,
      'conversation-decrypt-recovered': 1,
      'conversation-decrypt-failed': 1,
    },
    byBucket: {
      'missing-session': 2,
      'missing-dm-copy': 1,
    },
    recoveredBy: {
      'signal-session-ready': 1,
    },
  });
});

test('message decrypt diagnostics runtime installs a bounded debug surface on window', () => {
  const windowObj = {};
  const laneCalls = [];
  const cleanup = installMessageDecryptDebugSurface({
    windowObj,
    getActiveConversationDecryptSnapshotFn: () => ({
      conversation: { id: 'room-9', type: 'room' },
      pendingCount: 1,
      failedCount: 0,
      bucketCounts: { 'missing-sender-key': 1 },
      messages: [],
    }),
    getLaneDiagnosticsFn: () => {
      laneCalls.push('read');
      return [
        {
          lane: 'message-decrypt',
          event: 'conversation-decrypt-pending',
          details: { bucket: 'missing-sender-key' },
        },
      ];
    },
    clearLaneDiagnosticsFn: () => {
      laneCalls.push('clear');
    },
    readMessageDecryptElectronLogFn: async () => [{ event: 'conversation-decrypt-failed' }],
  });

  assert.deepEqual(windowObj.__guildMessagesDebug.decrypt.readDiagnostics(), [
    {
      lane: 'message-decrypt',
      event: 'conversation-decrypt-pending',
      details: { bucket: 'missing-sender-key' },
    },
  ]);
  assert.deepEqual(windowObj.__guildMessagesDebug.decrypt.summarizeDiagnostics(), {
    total: 1,
    byEvent: { 'conversation-decrypt-pending': 1 },
    byBucket: { 'missing-sender-key': 1 },
    recoveredBy: {},
  });
  assert.deepEqual(windowObj.__guildMessagesDebug.decrypt.readActiveConversation(), {
    conversation: { id: 'room-9', type: 'room' },
    pendingCount: 1,
    failedCount: 0,
    bucketCounts: { 'missing-sender-key': 1 },
    messages: [],
  });
  return windowObj.__guildMessagesDebug.decrypt.readElectronLog().then((entries) => {
    assert.deepEqual(entries, [{ event: 'conversation-decrypt-failed' }]);
    assert.deepEqual(windowObj.__guildMessagesDebug.decrypt.clearDiagnostics(), []);
    assert.deepEqual(laneCalls, ['read', 'read', 'clear']);

    cleanup();
    assert.equal(windowObj.__guildMessagesDebug, undefined);
  });
});

test('message decrypt diagnostics runtime parses and reads Electron decrypt log lines safely', async () => {
  assert.deepEqual(parseMessageDecryptDebugLogLines([
    '[2026-03-28T00:00:00.000Z] [message-decrypt] {"event":"conversation-decrypt-failed","details":{"bucket":"missing-dm-copy"}}',
    '[2026-03-28T00:00:01.000Z] [voice] {"event":"join_ready"}',
    '[2026-03-28T00:00:02.000Z] [message-decrypt] plain text',
  ]), [
    {
      event: 'conversation-decrypt-failed',
      details: {
        bucket: 'missing-dm-copy',
      },
    },
    {
      at: '2026-03-28T00:00:02.000Z',
      lane: 'message-decrypt',
      event: 'unparsed',
      details: {
        raw: 'plain text',
      },
    },
  ]);

  const entries = await readMessageDecryptElectronLog({
    windowObj: {
      electronAPI: {
        getDebugLogTail: async (scope, limit) => {
          assert.equal(scope, 'message-decrypt');
          assert.equal(limit, 5);
          return ['[2026-03-28T00:00:03.000Z] [message-decrypt] {"event":"conversation-decrypt-recovered"}'];
        },
      },
    },
    limit: 5,
  });

  assert.deepEqual(entries, [{
    event: 'conversation-decrypt-recovered',
  }]);
});
