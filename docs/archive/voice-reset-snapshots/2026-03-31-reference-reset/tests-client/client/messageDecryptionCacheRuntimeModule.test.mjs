import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message decryption cache runtime owns in-memory and persisted cache lifecycle behavior', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageDecryptionCacheRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /const decryptedMessageCache = new Map\(\)/);
  assert.match(source, /const persistedDecryptedMessageCache = new Map\(\)/);
  assert.match(source, /const pendingPersistedMessageLoads = new Map\(\)/);
  assert.match(source, /function deletePersistedMessageEntry\(/);
  assert.match(source, /function loadPersistedDecryptedMessage\(/);
  assert.match(source, /function loadPersistedDecryptedMessages\(/);
  assert.match(source, /function clearDecryptedMessageCaches\(/);
  assert.match(source, /function persistDecryptedMessage\(/);
  assert.match(source, /from '\.\/messageDecryptionCacheModel\.mjs'/);
});
