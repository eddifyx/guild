import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller runtime delegates upload and composer handlers to dedicated owners', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const uploadRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerUploadRuntime.mjs', import.meta.url),
    'utf8'
  );
  const composerRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerComposerRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useGuildChatDockControllerComposerRuntime\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useGuildChatDockControllerUploadRuntime\.mjs'/);
  assert.match(runtimeSource, /useGuildChatDockControllerUploadRuntime\(/);
  assert.match(runtimeSource, /useGuildChatDockControllerComposerRuntime\(/);
  assert.doesNotMatch(runtimeSource, /useCallback\(/);
  assert.doesNotMatch(runtimeSource, /uploadGuildChatPendingFiles\(/);
  assert.doesNotMatch(runtimeSource, /handleGuildChatPasteUpload\(/);
  assert.doesNotMatch(runtimeSource, /sendGuildChatComposerMessage\(/);
  assert.doesNotMatch(runtimeSource, /handleGuildChatComposerKeyEvent\(/);

  assert.match(uploadRuntimeSource, /function useGuildChatDockControllerUploadRuntime\(/);
  assert.match(composerRuntimeSource, /function useGuildChatDockControllerComposerRuntime\(/);
  assert.match(composerRuntimeSource, /useGuildChatDockControllerDraftRuntime\(/);
  assert.match(composerRuntimeSource, /useGuildChatDockControllerMentionRuntime\(/);
});
