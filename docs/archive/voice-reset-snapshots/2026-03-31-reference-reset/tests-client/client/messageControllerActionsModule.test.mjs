import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller actions delegate reload and mutation lanes to dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageControllerReloadActions\.mjs'/);
  assert.match(source, /from '\.\/messageControllerMutationActions\.mjs'/);
  assert.match(source, /createMessageControllerReloadActions\(/);
  assert.match(source, /createMessageControllerMutationActions\(/);
  assert.doesNotMatch(source, /buildMessageReloadOptions\(/);
  assert.doesNotMatch(source, /buildRetryFailedMessagesOptions\(/);
  assert.doesNotMatch(source, /buildMessageSendActionOptions\(/);
  assert.doesNotMatch(source, /buildMessageMutationOptions\(/);
});
