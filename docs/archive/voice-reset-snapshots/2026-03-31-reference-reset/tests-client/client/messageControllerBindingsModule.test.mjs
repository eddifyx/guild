import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller bindings delegate reload, subscription, and action builders through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageControllerReloadBindings\.mjs'/);
  assert.match(source, /from '\.\/messageControllerSubscriptionBindings\.mjs'/);
  assert.match(source, /from '\.\/messageControllerActionBindings\.mjs'/);
  assert.doesNotMatch(source, /function buildMessageReloadOptions\(/);
  assert.doesNotMatch(source, /function buildConversationRealtimeOptions\(/);
  assert.doesNotMatch(source, /function buildMessageSendActionOptions\(/);
});
