import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller reload bindings own reload and retry option builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerReloadBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildMessageReloadOptions\(/);
  assert.match(source, /function buildRetryFailedMessagesOptions\(/);
  assert.doesNotMatch(source, /function buildConversationRealtimeOptions\(/);
  assert.doesNotMatch(source, /function buildMessageSendActionOptions\(/);
});
