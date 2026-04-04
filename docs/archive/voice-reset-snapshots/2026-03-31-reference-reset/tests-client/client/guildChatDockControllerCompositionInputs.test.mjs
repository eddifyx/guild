import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller composition delegates runtime bag shaping to dedicated input builders', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/messaging/guildChatDockControllerCompositionInputs.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /buildUseGuildChatDockControllerRuntimeInput\(/);
  assert.doesNotMatch(compositionSource, /guildChat:\s*\{/);
  assert.doesNotMatch(compositionSource, /mentionState:\s*\{/);
  assert.doesNotMatch(compositionSource, /runtime:\s*\{/);
  assert.match(inputsSource, /function buildGuildChatDockControllerRuntimeGuildChatInput\(/);
  assert.match(inputsSource, /function buildGuildChatDockControllerRuntimeStateInput\(/);
  assert.match(inputsSource, /function buildGuildChatDockControllerRuntimeRefsInput\(/);
  assert.match(inputsSource, /function buildGuildChatDockControllerRuntimeMentionInput\(/);
  assert.match(inputsSource, /function buildGuildChatDockControllerRuntimeHelpersInput\(/);
  assert.match(inputsSource, /function buildUseGuildChatDockControllerRuntimeInput\(/);
});
