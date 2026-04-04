import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller delegates state, view-state, and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockController.mjs', import.meta.url),
    'utf8'
  );
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
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerState.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildChatDockControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildChatDockControllerState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildChatDockControllerViewState\.mjs'/);
  assert.match(controllerSource, /useGuildChatDockControllerState\(/);
  assert.match(controllerSource, /useGuildChatDockControllerViewState\(/);
  assert.match(controllerSource, /useGuildChatDockControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /useGuildChatDockRuntimeEffects\(/);
  assert.doesNotMatch(controllerSource, /useGuildChatDockControllerRuntime\(/);
  assert.doesNotMatch(controllerSource, /const \[draft, setDraft\] = useState\(/);
  assert.doesNotMatch(controllerSource, /findGuildMentionSuggestions\(/);

  assert.match(compositionSource, /useGuildChatDockControllerEffects\(/);
  assert.match(compositionSource, /buildUseGuildChatDockControllerRuntimeInput\(/);
  assert.match(compositionSource, /useGuildChatDockControllerRuntime\(/);
  assert.match(effectsSource, /function useGuildChatDockControllerEffects\(/);
  assert.match(inputsSource, /function buildUseGuildChatDockControllerRuntimeInput\(/);
  assert.match(runtimeSource, /useGuildChatDockControllerUploadRuntime\(/);
  assert.match(runtimeSource, /useGuildChatDockControllerComposerRuntime\(/);
  assert.match(stateSource, /function useGuildChatDockControllerState\(/);
  assert.match(viewStateSource, /function useGuildChatDockControllerViewState\(/);
});
