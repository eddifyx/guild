import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearDecryptedMessageCaches,
  deletePersistedMessageEntry,
  getCachedDecryptedMessage,
  hashCiphertext,
  loadPersistedDecryptedMessage,
  loadPersistedDecryptedMessages,
  persistDecryptedMessage,
  sanitizeCachedAttachments,
} from '../../../client/src/features/messaging/messageDecryptionCache.mjs';

test('message decryption cache hashes ciphertext and strips preview urls for persistence', () => {
  assert.notEqual(hashCiphertext('cipher-a'), hashCiphertext('cipher-b'));
  assert.deepEqual(
    sanitizeCachedAttachments([{ file_name: 'proof.png', _previewUrl: 'blob:preview', width: 10 }]),
    [{ file_name: 'proof.png', width: 10 }]
  );
});

test('message decryption cache persists and reuses decrypted entries from memory', async () => {
  const calls = [];
  const electronApi = {
    messageCacheSet(userId, messageId, payload) {
      calls.push(['set', userId, messageId, payload]);
      return Promise.resolve();
    },
  };
  const msg = { id: 'msg-1', encrypted: true, content: 'ciphertext' };

  clearDecryptedMessageCaches();
  persistDecryptedMessage(msg, 'hello', [{ file_name: 'proof.png' }], 'user-a', { electronApi });

  const cached = getCachedDecryptedMessage(msg, 'user-a');
  assert.equal(cached.body, 'hello');
  assert.equal(calls[0][0], 'set');
  assert.deepEqual(calls[0][3].attachments, [{ file_name: 'proof.png' }]);
});

test('message decryption cache loads persisted entries and rejects mismatched ciphertext', async () => {
  const electronApi = {
    async messageCacheGet() {
      return {
        ciphertextHash: hashCiphertext('ciphertext'),
        body: 'hello',
        attachments: [],
        cachedAt: Date.now(),
      };
    },
    async messageCacheDelete() {},
  };
  const msg = { id: 'msg-1', encrypted: true, content: 'ciphertext' };

  clearDecryptedMessageCaches();
  const loaded = await loadPersistedDecryptedMessage(msg, 'user-a', { electronApi });
  assert.equal(loaded.body, 'hello');

  const mismatched = await loadPersistedDecryptedMessage(
    { id: 'msg-2', encrypted: true, content: 'other-ciphertext' },
    'user-a',
    {
      electronApi: {
        async messageCacheGet() {
          return {
            ciphertextHash: hashCiphertext('ciphertext'),
            body: 'wrong',
            attachments: [],
            cachedAt: Date.now(),
          };
        },
        async messageCacheDelete() {},
      },
    },
  );
  assert.equal(mismatched, null);
});

test('message decryption cache bulk-loads entries and clears persisted state through the shared bridge', async () => {
  const deleted = [];
  const electronApi = {
    async messageCacheGetMany() {
      return {
        'msg-1': {
          ciphertextHash: hashCiphertext('ciphertext-1'),
          body: 'one',
          attachments: [],
          cachedAt: Date.now(),
        },
        'msg-2': {
          ciphertextHash: hashCiphertext('ciphertext-2'),
          body: 'two',
          attachments: [{ file_name: 'proof.png' }],
          cachedAt: Date.now(),
        },
      };
    },
    async messageCacheDelete(userId, messageId) {
      deleted.push([userId, messageId]);
    },
  };

  clearDecryptedMessageCaches();
  const entries = await loadPersistedDecryptedMessages([
    { id: 'msg-1', encrypted: true, content: 'ciphertext-1' },
    { id: 'msg-2', encrypted: true, content: 'ciphertext-2' },
  ], 'user-a', { electronApi });

  assert.equal(entries.get('msg-1').body, 'one');
  assert.deepEqual(entries.get('msg-2').attachments, [{ file_name: 'proof.png' }]);

  deletePersistedMessageEntry('user-a', 'msg-2', { electronApi });
  assert.deepEqual(deleted, [['user-a', 'msg-2']]);
});

test('message decryption cache fails open when the bulk persisted-cache bridge stalls', async () => {
  const warnings = [];
  const electronApi = {
    async messageCacheGetMany() {
      return new Promise(() => {});
    },
  };

  clearDecryptedMessageCaches();
  const entries = await loadPersistedDecryptedMessages([
    { id: 'msg-1', encrypted: true, content: 'ciphertext-1' },
  ], 'user-a', {
    electronApi,
    timeoutMs: 1,
    setTimeoutFn: (callback) => {
      callback();
      return 1;
    },
    clearTimeoutFn: () => {},
    warnFn: (...args) => warnings.push(args.join(' ')),
  });

  assert.deepEqual(entries, new Map());
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /message-cache:get-many timed out/i);
});
