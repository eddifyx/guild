import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action runtime controller inputs export the session and ui input builders', async () => {
  const source = await readFile(
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

  assert.match(source, /voiceHookActionSessionRuntimeInput/);
  assert.match(source, /voiceHookActionUiRuntimeInput/);
  assert.match(sessionSource, /export function buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(uiSource, /export function buildUseVoiceHookActionUiRuntimeInput/);
});

test('voice hook action runtime controller input builders preserve canonical action controller contracts', async () => {
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiRuntimeInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(sessionSource, /setVoiceChannelParticipantsFn/);
  assert.match(sessionSource, /normalizeVoiceErrorMessageFn/);
  assert.match(sessionSource, /roundRateFn/);
  assert.match(uiSource, /return buildUseVoiceHookActionUiControllerOptions\(\{/);
});
