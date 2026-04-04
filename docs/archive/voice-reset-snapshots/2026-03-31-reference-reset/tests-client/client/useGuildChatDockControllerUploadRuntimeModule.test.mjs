import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock upload runtime owns upload, drag, and pending-file handlers', async () => {
  const uploadRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerUploadRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(uploadRuntimeSource, /function revokeGuildChatPendingPreview\(/);
  assert.match(uploadRuntimeSource, /function useGuildChatDockControllerUploadRuntime\(/);
  assert.match(uploadRuntimeSource, /uploadGuildChatPendingFiles\(/);
  assert.match(uploadRuntimeSource, /handleGuildChatPasteUpload\(/);
  assert.match(uploadRuntimeSource, /handleGuildChatDragEnter\(/);
  assert.match(uploadRuntimeSource, /handleGuildChatDragOver\(/);
  assert.match(uploadRuntimeSource, /handleGuildChatDragLeave\(/);
  assert.match(uploadRuntimeSource, /handleGuildChatFileDrop\(/);
  assert.match(uploadRuntimeSource, /removeGuildChatPendingUpload\(/);
  assert.match(uploadRuntimeSource, /buildGuildChatUploadPendingFilesOptions\(/);
  assert.match(uploadRuntimeSource, /buildGuildChatPasteUploadOptions\(/);
  assert.match(uploadRuntimeSource, /buildGuildChatFileDropOptions\(/);
  assert.match(uploadRuntimeSource, /buildGuildChatRemovePendingUploadOptions\(/);
});
