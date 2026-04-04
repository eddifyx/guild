import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action runtime bindings export the canonical builder surface', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionBindings.mjs', import.meta.url),
    'utf8'
  );
  const sessionOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const sessionStateSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const sessionCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const sessionEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiBindings.mjs', import.meta.url),
    'utf8'
  );
  const uiOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const uiCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const uiEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsBindings.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsStateSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export\s+\{\s*buildUseVoiceHookActionSessionControllerOptions/);
  assert.match(source, /export\s+\{\s*buildUseVoiceHookActionUiControllerOptions/);
  assert.match(source, /export\s+\{[\s\S]*buildUseVoiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(sessionSource, /voiceHookActionSessionControllerOptions/);
  assert.match(uiSource, /voiceHookActionUiControllerOptions/);
  assert.match(runtimeEffectsSource, /voiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(sessionOptionsSource, /export function buildUseVoiceHookActionSessionControllerOptions/);
  assert.match(sessionStateSource, /export function buildUseVoiceHookActionSessionStateOptions/);
  assert.match(sessionCoreRuntimeSource, /export function buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(sessionEnvironmentSource, /export function buildUseVoiceHookActionSessionEnvironment/);
  assert.match(uiOptionsSource, /export function buildUseVoiceHookActionUiControllerOptions/);
  assert.match(uiCoreRuntimeSource, /export function buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(uiEnvironmentSource, /export function buildUseVoiceHookActionUiEnvironment/);
  assert.match(runtimeEffectsOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(runtimeEffectsOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions/);
  assert.match(runtimeEffectsStateSource, /export function buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(runtimeEffectsCoreRuntimeSource, /export function buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(runtimeEffectsEnvironmentSource, /export function buildUseVoiceHookActionRuntimeEffectsEnvironment/);
});

test('voice hook action runtime bindings compose the lower-level action builders and defaults', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionBindings.mjs', import.meta.url),
    'utf8'
  );
  const sessionOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const sessionCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const sessionEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiBindings.mjs', import.meta.url),
    'utf8'
  );
  const uiOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const uiCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const uiEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsBindings.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsCoreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookActionSessionBindings/);
  assert.match(source, /voiceHookActionUiBindings/);
  assert.match(source, /voiceHookActionRuntimeEffectsBindings/);
  assert.match(sessionSource, /voiceHookActionSessionControllerOptions/);
  assert.match(sessionOptionsSource, /buildUseVoiceHookActionSessionStateOptions/);
  assert.match(sessionOptionsSource, /buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(sessionOptionsSource, /buildUseVoiceHookActionSessionEnvironment/);
  assert.match(sessionCoreRuntimeSource, /createSendTransportFn: async \(nextChannelId\) => createSendTransport\(nextChannelId\)/);
  assert.match(sessionEnvironmentSource, /APPLE_VOICE_CAPTURE_OWNERS\.LIVE_VOICE/);
  assert.match(uiSource, /voiceHookActionUiControllerOptions/);
  assert.match(uiOptionsSource, /buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(uiOptionsSource, /buildUseVoiceHookActionUiEnvironment/);
  assert.match(uiCoreRuntimeSource, /scheduleVoiceHealthProbeFn: scheduleVoiceHealthProbe/);
  assert.match(uiEnvironmentSource, /scheduleVoiceLiveReconfigureFlowFn: scheduleVoiceLiveReconfigureFlow/);
  assert.match(runtimeEffectsSource, /voiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(runtimeEffectsOptionsSource, /buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(runtimeEffectsOptionsSource, /buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(runtimeEffectsOptionsSource, /buildUseVoiceHookActionRuntimeEffectsEnvironment/);
  assert.match(runtimeEffectsCoreRuntimeSource, /cleanupRemoteProducerFn: cleanupRemoteProducer/);
  assert.match(runtimeEffectsEnvironmentSource, /prefersAppleSystemVoiceIsolationFn: prefersAppleSystemVoiceIsolation/);
});
