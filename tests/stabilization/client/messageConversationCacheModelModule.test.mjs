import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation cache model owns cache keys, snapshot shaping, and chronological sort helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationCacheModel.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function getConversationCacheKey\(/);
  assert.match(source, /function sanitizeMessageForSnapshot\(/);
  assert.match(source, /function getMessageTimestampValue\(/);
  assert.match(source, /function sortMessagesChronologically\(/);
  assert.doesNotMatch(source, /loadPersistedConversationSnapshots\(/);
  assert.doesNotMatch(source, /getCachedConversationState\(/);
});
