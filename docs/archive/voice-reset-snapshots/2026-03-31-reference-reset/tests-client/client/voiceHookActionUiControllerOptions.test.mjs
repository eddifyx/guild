import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action ui controller options compose dedicated core-runtime and environment helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(source, /buildUseVoiceHookActionUiEnvironment/);
  assert.match(coreRuntimeSource, /export function buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(environmentSource, /export function buildUseVoiceHookActionUiEnvironment/);
});

test('voice hook action ui helper modules keep the shared reconfigure wiring intact', async () => {
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(coreRuntimeSource, /scheduleVoiceHealthProbeFn: scheduleVoiceHealthProbe/);
  assert.match(coreRuntimeSource, /switchLiveCaptureModeInPlaceFn: switchLiveCaptureModeInPlace/);
  assert.match(coreRuntimeSource, /deps:\s*\[/);
  assert.match(environmentSource, /scheduleVoiceLiveReconfigureFlowFn: scheduleVoiceLiveReconfigureFlow/);
  assert.match(environmentSource, /setTimeoutFn: window\.setTimeout\.bind\(window\)/);
  assert.match(environmentSource, /cancelPerfTraceFn: cancelPerfTrace/);
});
