import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings option builder hub delegates to dedicated builder owners', async () => {
  const hubSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsControllerOptionBuilders.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsRuntimeEffectsOptionBuilders.mjs', import.meta.url),
    'utf8'
  );
  const deviceSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsDeviceOptionBuilders.mjs', import.meta.url),
    'utf8'
  );
  const processingSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsProcessingModeOptionBuilders.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /audioSettingsRuntimeEffectsOptionBuilders/);
  assert.match(hubSource, /audioSettingsDeviceOptionBuilders/);
  assert.match(hubSource, /audioSettingsProcessingModeOptionBuilders/);
  assert.match(runtimeEffectsSource, /export function buildUseAudioSettingsRuntimeEffectsOptions/);
  assert.match(runtimeEffectsSource, /export function buildUseAudioSettingsRuntimeEffectsDeps/);
  assert.match(deviceSource, /export function buildAudioSettingsOutputRuntime/);
  assert.match(deviceSource, /export function buildAudioSettingsInputChangeHandlerOptions/);
  assert.match(processingSource, /export function buildAudioSettingsProcessingModeRuntime/);
});
