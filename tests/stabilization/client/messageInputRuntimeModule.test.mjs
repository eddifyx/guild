import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message input runtime delegates typing, upload, drag, and send helpers to dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageInputRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageInputTypingRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageInputUploadRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageInputDragRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageInputSendRuntime\.mjs'/);
  assert.doesNotMatch(source, /function emitMessageInputTyping\(/);
  assert.doesNotMatch(source, /function createMessageInputAttachmentUploader\(/);
  assert.doesNotMatch(source, /function createMessageInputDragHandlers\(/);
  assert.doesNotMatch(source, /function createMessageInputSendHandler\(/);
});
