import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller subscription bindings own realtime and lifecycle option builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerSubscriptionBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildConversationRealtimeOptions\(/);
  assert.match(source, /function buildConversationLifecycleOptions\(/);
  assert.doesNotMatch(source, /function buildMessageReloadOptions\(/);
  assert.doesNotMatch(source, /function buildMessageSendActionOptions\(/);
});
