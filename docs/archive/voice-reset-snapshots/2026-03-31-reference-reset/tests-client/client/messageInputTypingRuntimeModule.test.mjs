import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message input typing runtime owns typing payload emission through the shared model', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageInputTypingRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function emitMessageInputTyping\(/);
  assert.match(source, /getMessageInputTypingPayload\(/);
  assert.match(source, /socket\.emit/);
  assert.doesNotMatch(source, /createMessageInputAttachmentUploader\(/);
  assert.doesNotMatch(source, /createMessageInputSendHandler\(/);
});
