import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message input upload runtime owns attachment upload and pending-file removal handlers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageInputUploadRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createMessageInputAttachmentUploader\(/);
  assert.match(source, /function createPendingFileRemovalHandler\(/);
  assert.match(source, /uploadAttachmentFn/);
  assert.match(source, /deleteUploadFn/);
  assert.doesNotMatch(source, /hasFileDrag/);
  assert.doesNotMatch(source, /restoreFailedSendDraft/);
});
