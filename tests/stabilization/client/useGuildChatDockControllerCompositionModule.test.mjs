import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller composition owns runtime effect and handler orchestration', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerEffects.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/messaging/guildChatDockControllerCompositionInputs.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useGuildChatDockControllerComposition\(/);
  assert.match(compositionSource, /useGuildChatDockControllerEffects\(/);
  assert.match(compositionSource, /buildUseGuildChatDockControllerRuntimeInput\(/);
  assert.match(compositionSource, /useGuildChatDockControllerRuntime\(/);
  assert.doesNotMatch(compositionSource, /useGuildChatDockRuntimeEffects\(/);
  assert.doesNotMatch(compositionSource, /focusGuildChatComposer\(/);
  assert.doesNotMatch(compositionSource, /syncGuildChatComposerSelection\(/);
  assert.doesNotMatch(compositionSource, /updateGuildChatStickToBottom\(/);
  assert.match(effectsSource, /function useGuildChatDockControllerEffects\(/);
  assert.match(effectsSource, /useGuildChatDockRuntimeEffects\(/);
  assert.match(inputsSource, /function buildUseGuildChatDockControllerRuntimeInput\(/);
});
