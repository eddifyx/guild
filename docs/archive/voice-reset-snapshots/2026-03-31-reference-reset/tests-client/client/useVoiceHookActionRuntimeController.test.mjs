import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action runtime controller exports the expected hook factory', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookActionRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiRuntimeInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function useVoiceHookActionRuntimeController/);
  assert.match(source, /import\s+\{\s*useVoiceHookActionSessionRuntimeController\s*\}\s+from/);
  assert.match(source, /buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(source, /buildUseVoiceHookActionUiRuntimeInput/);
  assert.match(source, /useVoiceHookActionSessionRuntimeController\(buildUseVoiceHookActionSessionRuntimeInput\(\{/);
  assert.match(source, /useVoiceHookUiActionsController\(buildUseVoiceHookActionUiRuntimeInput\(\{/);
  assert.match(inputsSource, /voiceHookActionSessionRuntimeInput/);
  assert.match(inputsSource, /voiceHookActionUiRuntimeInput/);
  assert.match(sessionSource, /export function buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(uiSource, /export function buildUseVoiceHookActionUiRuntimeInput/);
});
