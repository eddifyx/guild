import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message decryption cache delegates model and runtime exports through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageDecryptionCache.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageDecryptionCacheModel\.mjs'/);
  assert.match(source, /from '\.\/messageDecryptionCacheRuntime\.mjs'/);
  assert.doesNotMatch(source, /function hashCiphertext\(/);
  assert.doesNotMatch(source, /function loadPersistedDecryptedMessage\(/);
  assert.doesNotMatch(source, /const decryptedMessageCache = new Map\(\)/);
});
