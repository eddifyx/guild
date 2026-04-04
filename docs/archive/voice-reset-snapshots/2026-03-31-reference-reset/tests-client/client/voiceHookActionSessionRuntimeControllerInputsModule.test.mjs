import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action session runtime input hub delegates to dedicated owner modules', async () => {
  const hubSource = await readFile(
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
  const leaveRefSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionLeaveRef.mjs', import.meta.url),
    'utf8'
  );
  const valueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeValue.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /voiceHookActionSessionActionsInput/);
  assert.match(hubSource, /voiceHookActionSessionRuntimeEffectsInput/);
  assert.match(hubSource, /voiceHookActionSessionLeaveRef/);
  assert.match(hubSource, /voiceHookActionSessionRuntimeValue/);
  assert.match(actionsSource, /export function buildUseVoiceHookActionSessionActionsInput/);
  assert.match(effectsSource, /export function buildUseVoiceHookActionSessionRuntimeEffectsInput/);
  assert.match(leaveRefSource, /export function syncUseVoiceHookActionSessionLeaveRef/);
  assert.match(valueSource, /export function buildUseVoiceHookActionSessionRuntimeValue/);
});
