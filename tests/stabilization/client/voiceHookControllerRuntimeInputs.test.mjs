import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook controller runtime inputs export the dedicated core and action builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeInputs.mjs', import.meta.url),
    'utf8'
  );
  const coreSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const actionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookCoreRuntimeInput/);
  assert.match(source, /voiceHookActionRuntimeInput/);
  assert.match(coreSource, /export function buildUseVoiceHookCoreRuntimeInput/);
  assert.match(actionSource, /export function buildUseVoiceHookActionRuntimeInput/);
});

test('voice hook controller runtime inputs wire the canonical imported deps into the controller option builders', async () => {
  const coreSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const actionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(coreSource, /buildUseVoiceHookCoreRuntimeControllerOptions/);
  assert.match(coreSource, /clearVoiceKey/);
  assert.match(coreSource, /recordLaneDiagnostic/);
  assert.match(coreSource, /playStreamStopChime/);
  assert.match(actionSource, /buildUseVoiceHookActionRuntimeControllerOptions/);
  assert.match(actionSource, /buildUseVoiceHookActionCoreRuntime/);
  assert.match(actionSource, /applyVoiceModeDependencies/);
  assert.match(actionSource, /persistVoiceProcessingMode/);
  assert.match(actionSource, /persistNoiseSuppressionEnabled/);
  assert.match(actionSource, /isUltraLowLatencyMode/);
  assert.match(actionSource, /roundRate/);
});
