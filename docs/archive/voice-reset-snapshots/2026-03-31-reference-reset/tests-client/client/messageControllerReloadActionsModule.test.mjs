import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller reload actions own reload and retry flow wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerReloadActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createMessageControllerReloadActions\(/);
  assert.match(source, /buildMessageReloadOptions\(/);
  assert.match(source, /buildRetryFailedMessagesOptions\(/);
  assert.match(source, /runMessageReloadFlowFn/);
  assert.match(source, /retryFailedConversationMessagesFn/);
  assert.match(source, /prevConvRef\.current === null/);
  assert.doesNotMatch(source, /buildMessageSendActionOptions\(/);
  assert.doesNotMatch(source, /buildMessageMutationOptions\(/);
});
