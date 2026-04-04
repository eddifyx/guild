import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyConversationDecryptFailure,
  clearMessageDecryptRuntime,
  decryptConversationMessages,
  recordConversationDecryptDiagnostic,
  shouldKeepConversationDecryptPending,
  tryDecryptConversationMessage,
} from '../../../client/src/features/messaging/messageDecryptFlow.mjs';

test.afterEach(() => {
  clearMessageDecryptRuntime();
});

test('message decrypt flow reuses cached decrypted entries before any transport work', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-1',
      sender_id: 'user-b',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    isE2EInitializedFn: () => true,
    getCachedDecryptedMessageFn: () => ({
      body: 'cached body',
      attachments: [{ id: 'attachment-1' }],
    }),
    decryptDirectMessageFn: async () => {
      throw new Error('should not decrypt');
    },
  });

  assert.equal(result._decrypted, true);
  assert.equal(result.content, 'cached body');
  assert.equal(result._decryptedAttachments.length, 1);
});

test('message decrypt flow reuses persisted plaintext even before E2E initialization completes', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-init-persisted',
      sender_id: 'user-b',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    isE2EInitializedFn: () => false,
    loadPersistedDecryptedMessageFn: async () => ({
      body: 'persisted before init',
      attachments: [{ id: 'attachment-init' }],
    }),
    decryptDirectMessageFn: async () => {
      throw new Error('should not decrypt before init when persisted plaintext exists');
    },
  });

  assert.equal(result._decrypted, true);
  assert.equal(result.content, 'persisted before init');
  assert.equal(result._decryptedAttachments.length, 1);
});

test('message decrypt flow keeps encrypted messages pending until E2E initialization completes', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-init-pending',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      sender_npub: 'npub-user-b',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    nowFn: () => 23456,
    isE2EInitializedFn: () => false,
    rememberUserNpubFn: () => {},
    decryptDirectMessageFn: async () => {
      throw new Error('should not decrypt before init');
    },
  });

  assert.equal(result._decryptionPending, true);
  assert.equal(result._decryptionPendingSince, 23456);
  assert.equal(result._decryptionFailed, false);
  assert.equal(result.content, null);
});

test('message decrypt flow returns pending room messages when fast open defers decryption', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-2',
      room_id: 'room-1',
      sender_id: 'user-b',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    options: {
      deferRoomDecrypt: true,
      allowRoomSenderKeyRecovery: false,
    },
    nowFn: () => 12345,
    isE2EInitializedFn: () => true,
  });

  assert.equal(result._decryptionPending, true);
  assert.equal(result._decryptionPendingSince, 12345);
  assert.equal(result._decryptionFailed, false);
});

test('message decrypt flow retries room sender-key recovery before failing the message', async () => {
  const calls = [];
  let decryptAttempts = 0;

  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-3',
      room_id: 'room-1',
      sender_id: 'user-b',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    retryState: { attemptedSenderIds: new Set() },
    isE2EInitializedFn: () => true,
    decryptGroupMessageFn: async () => {
      decryptAttempts += 1;
      if (decryptAttempts === 1) throw new Error('missing sender key state');
      return { body: 'decrypted room body', attachments: [] };
    },
    persistDecryptedMessageFn: (...args) => calls.push(['persist', ...args]),
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    syncRoomSenderKeysFn: async (...args) => {
      calls.push(['sync', ...args]);
      return 1;
    },
    requestRoomSenderKeyFn: async () => {
      calls.push(['request']);
      return false;
    },
    waitForSenderKeyUpdateFn: async () => {
      calls.push(['wait']);
      return false;
    },
  });

  assert.equal(result._decrypted, true);
  assert.equal(result.content, 'decrypted room body');
  assert.equal(decryptAttempts, 2);
  assert.deepEqual(calls.map(([name]) => name), ['flush', 'sync', 'flush', 'persist']);
});

test('message decrypt flow keeps retryable DM failures pending instead of surfacing a hard failure immediately', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-dm-pending',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    nowFn: () => 45678,
    isE2EInitializedFn: () => true,
    decryptDirectMessageFn: async () => {
      throw new Error('Secure messaging is waiting for this contact\'s Nostr identity.');
    },
  });

  assert.equal(result._decryptionPending, true);
  assert.equal(result._decryptionPendingSince, 45678);
  assert.equal(result._decryptionFailed, false);
});

test('message decrypt flow marks recoverable session and identity misses as pending candidates', () => {
  assert.equal(
    classifyConversationDecryptFailure({
      error: new Error('missing sender key state for room-1'),
    }),
    'missing-sender-key'
  );
  assert.equal(
    classifyConversationDecryptFailure({
      error: new Error('session with device 2 not found'),
    }),
    'missing-session'
  );
  assert.equal(
    classifyConversationDecryptFailure({
      error: new Error('totally unexpected'),
    }),
    'other'
  );
  assert.equal(
    shouldKeepConversationDecryptPending({
      message: { encrypted: true },
      error: new Error('No DM copy available for device 7'),
    }),
    true
  );
  assert.equal(
    shouldKeepConversationDecryptPending({
      message: { encrypted: true },
      error: new Error('DuplicatedMessage'),
    }),
    false
  );
});

test('message decrypt flow does not report transient pending failures as hard decrypt errors', async () => {
  const reported = [];

  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-dm-transient',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    isE2EInitializedFn: () => true,
    decryptDirectMessageFn: async () => {
      throw new Error('No DM copy available for device 7');
    },
    reportDecryptFailureFn: (payload) => {
      reported.push(payload);
    },
  });

  assert.equal(result._decryptionPending, true);
  assert.deepEqual(reported, []);
});

test('message decrypt flow records bucketed pending and recovered diagnostics without message contents', async () => {
  const diagnostics = [];

  const pendingResult = await tryDecryptConversationMessage({
    message: {
      id: 'message-diagnostic-pending',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      content: 'ciphertext',
    },
    userId: 'user-a',
    isE2EInitializedFn: () => false,
    nowFn: () => 101,
    recordDecryptDiagnosticFn: (payload) => diagnostics.push(payload),
  });

  const recoveredResult = await tryDecryptConversationMessage({
    message: {
      id: 'message-diagnostic-recovered',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      content: 'ciphertext',
      _decryptionPending: true,
      _decryptionPendingSince: 101,
    },
    userId: 'user-a',
    isE2EInitializedFn: () => true,
    loadPersistedDecryptedMessageFn: async () => ({
      body: 'persisted plaintext',
      attachments: [],
    }),
    recordDecryptDiagnosticFn: (payload) => diagnostics.push(payload),
  });

  assert.equal(pendingResult._decryptionPending, true);
  assert.equal(recoveredResult._decrypted, true);
  assert.deepEqual(
    diagnostics.map(({ event, bucket, recoveredVia }) => [event, bucket || null, recoveredVia || null]),
    [
      ['pending', 'e2e-not-ready', null],
      ['recovered', null, 'persisted'],
    ]
  );
});

test('message decrypt flow clears stale pending and failure flags when a retry finally decrypts', async () => {
  const result = await tryDecryptConversationMessage({
    message: {
      id: 'message-recovered-visible',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      content: 'ciphertext',
      _decryptionPending: true,
      _decryptionPendingSince: 111,
      _decryptionFailed: true,
      _decryptionError: 'Decryption failed',
      _decryptionBucket: 'missing-session',
    },
    userId: 'user-a',
    isE2EInitializedFn: () => true,
    decryptDirectMessageFn: async () => ({
      body: 'finally visible',
      attachments: [],
    }),
  });

  assert.equal(result._decrypted, true);
  assert.equal(result.content, 'finally visible');
  assert.equal(result._decryptionPending, false);
  assert.equal(result._decryptionFailed, false);
  assert.equal(result._decryptionPendingSince, null);
  assert.equal(result._decryptionError, null);
  assert.equal(result._decryptionBucket, null);
});

test('message decrypt flow builds bounded lane diagnostics for failed and recovered states', () => {
  const recorded = [];

  recordConversationDecryptDiagnostic({
    message: {
      id: 'message-lane-failed',
      room_id: 'room-1',
      sender_id: 'user-b',
      encrypted: true,
      _decryptionFailed: true,
    },
    event: 'failed',
    error: new Error('missing sender key state for room-1'),
    recordLaneDiagnosticFn: (...args) => {
      recorded.push(args);
      return args;
    },
  });

  recordConversationDecryptDiagnostic({
    message: {
      id: 'message-lane-failed',
      room_id: 'room-1',
      sender_id: 'user-b',
      encrypted: true,
      _decryptionFailed: true,
    },
    event: 'failed',
    error: new Error('missing sender key state for room-1'),
    recordLaneDiagnosticFn: (...args) => {
      recorded.push(args);
      return args;
    },
  });

  recordConversationDecryptDiagnostic({
    message: {
      id: 'message-lane-recovered',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      _decryptionPending: true,
    },
    event: 'recovered',
    recoveredVia: 'decrypt',
    recordLaneDiagnosticFn: (...args) => {
      recorded.push(args);
      return args;
    },
  });

  assert.equal(recorded.length, 2);
  assert.equal(recorded[0][0], 'message-decrypt');
  assert.equal(recorded[0][1], 'conversation-decrypt-failed');
  assert.equal(recorded[0][2].bucket, 'missing-sender-key');
  assert.equal(recorded[0][2].route, 'room');
  assert.equal(recorded[1][1], 'conversation-decrypt-recovered');
  assert.equal(recorded[1][2].previousState, 'pending');
  assert.equal(recorded[1][2].recoveredVia, 'decrypt');
});

test('message decrypt flow preloads persisted entries once for a batch', async () => {
  const loadedBatches = [];

  const results = await decryptConversationMessages({
    messages: [
      { id: 'message-4', sender_id: 'user-b', encrypted: true, content: 'ciphertext-a' },
      { id: 'message-5', sender_id: 'user-c', encrypted: true, content: 'ciphertext-b' },
    ],
    userId: 'user-a',
    isE2EInitializedFn: () => true,
    loadPersistedDecryptedMessagesFn: async (messages) => {
      loadedBatches.push(messages.map((message) => message.id));
      return new Map([
        ['message-4', { body: 'persisted body', attachments: [] }],
      ]);
    },
    loadPersistedDecryptedMessageFn: async () => {
      throw new Error('single persisted load should not run when the batch is preloaded');
    },
    decryptDirectMessageFn: async (_senderId, ciphertext) => ({
      body: `decrypted:${ciphertext}`,
      attachments: [],
    }),
    persistDecryptedMessageFn: () => {},
  });

  assert.deepEqual(loadedBatches, [['message-4', 'message-5']]);
  assert.equal(results[0].content, 'persisted body');
  assert.equal(results[1].content, 'decrypted:ciphertext-b');
});
