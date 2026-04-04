import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock mention runtime owns key and mention selection handlers', async () => {
  const mentionRuntimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerMentionRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(mentionRuntimeSource, /function useGuildChatDockControllerMentionRuntime\(/);
  assert.match(mentionRuntimeSource, /handleGuildChatComposerKeyEvent\(/);
  assert.match(mentionRuntimeSource, /applyGuildChatMentionSelection\(/);
  assert.match(mentionRuntimeSource, /buildGuildChatComposerKeyOptions\(/);
  assert.match(mentionRuntimeSource, /buildGuildChatMentionSelectionOptions\(/);
  assert.match(mentionRuntimeSource, /applyMentionSuggestionFn:\s*applyMentionSuggestion/);
  assert.doesNotMatch(mentionRuntimeSource, /applyGuildChatDraftInput\(/);
  assert.doesNotMatch(mentionRuntimeSource, /sendGuildChatComposerMessage\(/);
  assert.doesNotMatch(mentionRuntimeSource, /buildGuildChatDraftChangeOptions\(/);
  assert.doesNotMatch(mentionRuntimeSource, /buildGuildChatSendMessageOptions\(/);
});
