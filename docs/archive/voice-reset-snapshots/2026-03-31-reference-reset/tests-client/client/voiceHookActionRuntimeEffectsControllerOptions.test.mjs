import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action runtime-effects controller options compose dedicated state, core-runtime, and environment helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(source, /buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(source, /buildUseVoiceHookActionRuntimeEffectsEnvironment/);
  assert.match(stateSource, /export function buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(coreRuntimeSource, /export function buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(environmentSource, /export function buildUseVoiceHookActionRuntimeEffectsEnvironment/);
});

test('voice hook action runtime-effects helper modules keep the shared diagnostics wiring intact', async () => {
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(coreRuntimeSource, /cleanupRemoteProducerFn: cleanupRemoteProducer/);
  assert.match(coreRuntimeSource, /consumeProducerFn: consumeProducer/);
  assert.match(coreRuntimeSource, /maybeAdaptScreenShareProfileFn: maybeAdaptScreenShareProfile/);
  assert.match(environmentSource, /electronAPI: window\.electronAPI/);
  assert.match(environmentSource, /screenShareProfiles: SCREEN_SHARE_PROFILES/);
  assert.match(environmentSource, /clearTimeoutFn: clearTimeout/);
});
