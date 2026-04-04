import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation fetch flow owns sender-key sync, url building, and conversation fetch helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationFetchFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function syncConversationRoomSenderKeys\(/);
  assert.match(source, /function buildConversationMessagesUrl\(/);
  assert.match(source, /function fetchConversationMessages\(/);
  assert.doesNotMatch(source, /function warmRoomMessageCache\(/);
});
