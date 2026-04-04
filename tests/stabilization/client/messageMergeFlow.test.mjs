import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendOrReplaceMessage,
  getMessageTimestampValue,
  mergeDecryptedAttachments,
  mergeMessagesById,
  prependOlderMessages,
  preserveReadableMessage,
  replaceMessagesFromSnapshot,
  sortMessagesChronologically,
} from '../../../client/src/features/messaging/messageMergeFlow.mjs';

test('message merge flow preserves readable decrypted content when an incoming copy is still ciphertext', () => {
  const existing = {
    id: 'msg-1',
    sender_name: 'Alice',
    content: 'decrypted text',
    _decrypted: true,
    _decryptedAttachments: [{ file_name: 'proof.png', _previewUrl: 'blob:preview' }],
    _ciphertextContent: 'ciphertext',
  };
  const incoming = {
    id: 'msg-1',
    sender_name: '',
    content: null,
    _decrypted: false,
  };

  const preserved = preserveReadableMessage(existing, incoming);
  assert.equal(preserved.content, 'decrypted text');
  assert.equal(preserved._decrypted, true);
  assert.equal(preserved._decryptedAttachments[0]._previewUrl, 'blob:preview');
});

test('message merge flow merges decrypted attachments by stable identity', () => {
  const merged = mergeDecryptedAttachments(
    [{ file_name: 'proof.png', _previewUrl: 'blob:preview', width: 10 }],
    [{ file_name: 'proof.png', height: 20 }],
  );

  assert.deepEqual(merged, [{
    file_name: 'proof.png',
    _previewUrl: 'blob:preview',
    width: 10,
    height: 20,
  }]);
});

test('message merge flow sorts timestamps and merges snapshots without losing newer local messages', () => {
  const existing = [
    { id: 'msg-1', created_at: '2026-01-01 00:00:00' },
    { id: 'msg-3', created_at: '2026-01-03 00:00:00' },
  ];
  const incoming = [
    { id: 'msg-2', created_at: '2026-01-02 00:00:00' },
  ];

  assert.deepEqual(
    sortMessagesChronologically([...existing, ...incoming]).map((message) => message.id),
    ['msg-1', 'msg-2', 'msg-3']
  );
  assert.deepEqual(
    replaceMessagesFromSnapshot(existing, incoming).map((message) => message.id),
    ['msg-2', 'msg-3']
  );
});

test('message merge flow merges by id and client nonce for optimistic replacement', () => {
  const existing = [
    { id: 'local-1', _clientNonce: 'nonce-1', created_at: '2026-01-01 00:00:00', content: 'pending' },
  ];
  const incoming = {
    id: 'server-1',
    client_nonce: 'nonce-1',
    created_at: '2026-01-01 00:00:01',
    content: 'delivered',
  };

  assert.deepEqual(
    appendOrReplaceMessage(existing, incoming).map((message) => message.id),
    ['server-1']
  );

  const existingById = [{ id: 'server-1', created_at: '2026-01-01 00:00:00', content: 'pending' }];
  assert.equal(
    mergeMessagesById(existingById, [incoming])[0].content,
    'delivered'
  );
});

test('message merge flow prepends older history and keeps the combined list chronological', () => {
  const existing = [
    { id: 'msg-3', created_at: '2026-01-03 00:00:00' },
    { id: 'msg-4', created_at: '2026-01-04 00:00:00' },
  ];
  const older = [
    { id: 'msg-1', created_at: '2026-01-01 00:00:00' },
    { id: 'msg-2', created_at: '2026-01-02 00:00:00' },
  ];

  assert.deepEqual(
    prependOlderMessages(existing, older).map((message) => message.id),
    ['msg-1', 'msg-2', 'msg-3', 'msg-4']
  );
  assert.ok(getMessageTimestampValue({ created_at: '2026-01-01 00:00:00' }) < Number.MAX_SAFE_INTEGER);
});
