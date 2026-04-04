import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message input drag runtime owns drag state clearing and drag-drop handlers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageInputDragRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function clearMessageInputDragState\(/);
  assert.match(source, /function createMessageInputDragHandlers\(/);
  assert.match(source, /hasFileDrag/);
  assert.match(source, /handleDragEnter/);
  assert.match(source, /handleDrop/);
  assert.doesNotMatch(source, /restoreFailedSendDraft/);
  assert.doesNotMatch(source, /uploadAttachmentFn/);
});
