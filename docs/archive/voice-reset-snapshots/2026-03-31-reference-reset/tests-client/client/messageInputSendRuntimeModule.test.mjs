import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message input send runtime owns draft restore and send handlers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageInputSendRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function restoreFailedSendDraft\(/);
  assert.match(source, /function createMessageInputSendHandler\(/);
  assert.match(source, /restoreFailedSendDraftFn/);
  assert.match(source, /requestAnimationFrameFn/);
  assert.doesNotMatch(source, /hasFileDrag/);
  assert.doesNotMatch(source, /getMessageInputTypingPayload\(/);
});
