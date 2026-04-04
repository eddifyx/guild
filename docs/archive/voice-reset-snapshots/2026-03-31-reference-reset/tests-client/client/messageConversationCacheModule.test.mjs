import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation cache delegates model, snapshot, and memory owners through one export hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationCache.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageConversationCacheModel\.mjs'/);
  assert.match(source, /from '\.\/messageConversationSnapshotRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageConversationMemoryRuntime\.mjs'/);
  assert.doesNotMatch(source, /function getConversationCacheKey\(/);
  assert.doesNotMatch(source, /function loadPersistedConversationSnapshots\(/);
  assert.doesNotMatch(source, /function getCachedConversationState\(/);
});
