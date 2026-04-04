import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller mutation actions own send, load, edit, and delete wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerMutationActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createMessageControllerMutationActions\(/);
  assert.match(source, /buildMessageSendActionOptions\(/);
  assert.match(source, /buildLoadMoreMessagesActionOptions\(/);
  assert.match(source, /buildMessageMutationOptions\(/);
  assert.match(source, /createMessageSendActionFn/);
  assert.match(source, /createLoadMoreMessagesActionFn/);
  assert.doesNotMatch(source, /buildMessageReloadOptions\(/);
  assert.doesNotMatch(source, /buildRetryFailedMessagesOptions\(/);
});
