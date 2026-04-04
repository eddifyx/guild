import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller action bindings own send, load-more, and mutation option builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerActionBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildMessageSendActionOptions\(/);
  assert.match(source, /function buildLoadMoreMessagesActionOptions\(/);
  assert.match(source, /function buildMessageMutationOptions\(/);
  assert.doesNotMatch(source, /function buildMessageReloadOptions\(/);
  assert.doesNotMatch(source, /function buildConversationRealtimeOptions\(/);
});
