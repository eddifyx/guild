import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action session runtime controller exports the expected hook factory', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookActionSessionRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionActionsInput.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeEffectsInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function useVoiceHookActionSessionRuntimeController/);
  assert.match(source, /import\s+\{\s*useVoiceHookSessionActionsController\s*\}\s+from/);
  assert.match(source, /import\s+\{\s*useVoiceHookRuntimeEffectsController\s*\}\s+from/);
  assert.match(source, /voiceHookActionSessionRuntimeControllerInputs/);
  assert.match(source, /buildUseVoiceHookActionSessionActionsInput/);
  assert.match(source, /buildUseVoiceHookActionSessionRuntimeEffectsInput/);
  assert.match(source, /syncUseVoiceHookActionSessionLeaveRef/);
  assert.match(source, /buildUseVoiceHookActionSessionRuntimeValue/);
  assert.match(source, /useVoiceHookSessionActionsController\(buildUseVoiceHookActionSessionActionsInput\(\{/);
  assert.match(source, /useVoiceHookRuntimeEffectsController\(buildUseVoiceHookActionSessionRuntimeEffectsInput\(\{/);
  assert.match(inputsSource, /voiceHookActionSessionActionsInput/);
  assert.match(inputsSource, /voiceHookActionSessionRuntimeEffectsInput/);
  assert.match(actionsSource, /export function buildUseVoiceHookActionSessionActionsInput/);
  assert.match(effectsSource, /export function buildUseVoiceHookActionSessionRuntimeEffectsInput/);
});
