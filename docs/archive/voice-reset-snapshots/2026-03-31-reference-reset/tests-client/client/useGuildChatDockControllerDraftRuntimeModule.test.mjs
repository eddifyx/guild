import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock draft runtime owns draft change and send handlers', async () => {
  const draftRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerDraftRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(draftRuntimeSource, /function useGuildChatDockControllerDraftRuntime\(/);
  assert.match(draftRuntimeSource, /applyGuildChatDraftInput\(/);
  assert.match(draftRuntimeSource, /sendGuildChatComposerMessage\(/);
  assert.match(draftRuntimeSource, /buildGuildChatDraftChangeOptions\(/);
  assert.match(draftRuntimeSource, /buildGuildChatSendMessageOptions\(/);
  assert.doesNotMatch(draftRuntimeSource, /handleGuildChatComposerKeyEvent\(/);
  assert.doesNotMatch(draftRuntimeSource, /applyGuildChatMentionSelection\(/);
  assert.doesNotMatch(draftRuntimeSource, /buildGuildChatComposerKeyOptions\(/);
  assert.doesNotMatch(draftRuntimeSource, /buildGuildChatMentionSelectionOptions\(/);
});
