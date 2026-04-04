import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action session runtime controller inputs export the canonical builders', async () => {
  const source = await readFile(
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

  assert.match(source, /voiceHookActionSessionActionsInput/);
  assert.match(source, /voiceHookActionSessionRuntimeEffectsInput/);
  assert.match(source, /voiceHookActionSessionLeaveRef/);
  assert.match(source, /voiceHookActionSessionRuntimeValue/);
  assert.match(actionsSource, /export function buildUseVoiceHookActionSessionActionsInput/);
  assert.match(effectsSource, /export function buildUseVoiceHookActionSessionRuntimeEffectsInput/);
  assert.match(leaveRefSource, /export function syncUseVoiceHookActionSessionLeaveRef/);
  assert.match(valueSource, /export function buildUseVoiceHookActionSessionRuntimeValue/);
});

test('voice hook action session runtime controller inputs preserve session wiring contracts', async () => {
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

  assert.match(actionsSource, /buildUseVoiceHookActionSessionControllerOptions\(\{/);
  assert.match(effectsSource, /buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions\(\{/);
  assert.match(effectsSource, /buildUseVoiceHookActionRuntimeEffectsControllerOptions\(\{/);
  assert.match(leaveRefSource, /leaveChannelRef\.current = leaveChannel/);
  assert.match(valueSource, /return\s+\{\s*joinChannel,\s*leaveChannel,\s*\}/);
});
