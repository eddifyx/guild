import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation memory runtime owns in-memory cache reads, writes, updates, and cleanup', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationMemoryRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /const conversationMessageCache = new Map\(\)/);
  assert.match(source, /function getCachedConversationState\(/);
  assert.match(source, /function cacheConversationState\(/);
  assert.match(source, /function updateCachedConversationState\(/);
  assert.match(source, /function clearConversationCacheState\(/);
  assert.match(source, /getPersistedConversationState\(/);
  assert.match(source, /persistConversationState\(/);
  assert.doesNotMatch(source, /function loadPersistedConversationSnapshots\(/);
});
