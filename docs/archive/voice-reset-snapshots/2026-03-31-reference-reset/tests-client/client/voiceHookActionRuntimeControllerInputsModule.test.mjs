import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action runtime input hub delegates to dedicated session and ui owner modules', async () => {
  const hubSource = await readFile(
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

  assert.match(hubSource, /voiceHookActionSessionRuntimeInput/);
  assert.match(hubSource, /voiceHookActionUiRuntimeInput/);
  assert.match(sessionSource, /export function buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(uiSource, /export function buildUseVoiceHookActionUiRuntimeInput/);
});
