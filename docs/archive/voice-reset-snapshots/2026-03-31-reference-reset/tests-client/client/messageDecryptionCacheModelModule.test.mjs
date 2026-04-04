import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message decryption cache model owns cache keys, ciphertext hashing, and attachment sanitization', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageDecryptionCacheModel.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function getMessageCacheMapKey\(/);
  assert.match(source, /function getMessageCiphertext\(/);
  assert.match(source, /function hashCiphertext\(/);
  assert.match(source, /function sanitizeCachedAttachments\(/);
  assert.doesNotMatch(source, /function loadPersistedDecryptedMessage\(/);
  assert.doesNotMatch(source, /function persistDecryptedMessage\(/);
});
