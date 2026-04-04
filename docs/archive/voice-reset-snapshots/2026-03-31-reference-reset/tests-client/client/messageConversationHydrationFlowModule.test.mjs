import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation hydration flow owns conversation matching, hydration, timestamps, and readable persistence', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationHydrationFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function messageBelongsToConversation\(/);
  assert.match(source, /function createConversationTimestamp\(/);
  assert.match(source, /function hydrateConversationState\(/);
  assert.match(source, /function persistReadableConversationMessages\(/);
  assert.doesNotMatch(source, /function clearAllMessageCaches\(/);
  assert.doesNotMatch(source, /function resetMessageLaneState\(/);
});
