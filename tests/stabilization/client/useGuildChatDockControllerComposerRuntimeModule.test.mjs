import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock composer runtime delegates draft and mention handlers to dedicated owners', async () => {
  const composerRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerComposerRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(composerRuntimeSource, /function useGuildChatDockControllerComposerRuntime\(/);
  assert.match(composerRuntimeSource, /from '\.\/useGuildChatDockControllerDraftRuntime\.mjs'/);
  assert.match(composerRuntimeSource, /from '\.\/useGuildChatDockControllerMentionRuntime\.mjs'/);
  assert.match(composerRuntimeSource, /useGuildChatDockControllerDraftRuntime\(/);
  assert.match(composerRuntimeSource, /useGuildChatDockControllerMentionRuntime\(/);
  assert.doesNotMatch(composerRuntimeSource, /applyGuildChatDraftInput\(/);
  assert.doesNotMatch(composerRuntimeSource, /sendGuildChatComposerMessage\(/);
  assert.doesNotMatch(composerRuntimeSource, /handleGuildChatComposerKeyEvent\(/);
  assert.doesNotMatch(composerRuntimeSource, /applyGuildChatMentionSelection\(/);
});
