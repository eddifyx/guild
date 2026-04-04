import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation snapshot runtime owns persisted snapshot load, save, read, and prune behavior', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationSnapshotRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function loadPersistedConversationSnapshots\(/);
  assert.match(source, /function savePersistedConversationSnapshots\(/);
  assert.match(source, /function getPersistedConversationState\(/);
  assert.match(source, /function persistConversationState\(/);
  assert.match(source, /getConversationCacheKey\(/);
  assert.match(source, /sanitizeMessageForSnapshot/);
  assert.doesNotMatch(source, /getCachedConversationState\(/);
  assert.doesNotMatch(source, /conversationMessageCache/);
});
