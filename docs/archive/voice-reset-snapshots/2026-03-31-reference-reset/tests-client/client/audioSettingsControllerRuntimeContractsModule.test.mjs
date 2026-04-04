import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller runtime contracts module delegates to dedicated contract owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsControllerRuntimeContracts.mjs', import.meta.url),
    'utf8'
  );
  const attachMonitorSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsAttachMonitorContract.mjs', import.meta.url),
    'utf8'
  );
  const appleSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsAppleIsolationContract.mjs', import.meta.url),
    'utf8'
  );
  const micTestSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsMicTestStartContract.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsRuntimeEffectsContract.mjs', import.meta.url),
    'utf8'
  );
  const outputChangeSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsOutputChangeContract.mjs', import.meta.url),
    'utf8'
  );
  const processingModeSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsProcessingModeContract.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /audioSettingsAttachMonitorContract/);
  assert.match(source, /audioSettingsAppleIsolationContract/);
  assert.match(source, /audioSettingsMicTestStartContract/);
  assert.match(source, /audioSettingsRuntimeEffectsContract/);
  assert.match(source, /audioSettingsOutputChangeContract/);
  assert.match(source, /audioSettingsProcessingModeContract/);
  assert.match(attachMonitorSource, /export function buildAudioSettingsAttachMonitorContract/);
  assert.match(appleSource, /export function buildAudioSettingsAppleIsolationContract/);
  assert.match(micTestSource, /export function buildAudioSettingsMicTestStartContract/);
  assert.match(runtimeEffectsSource, /export function buildAudioSettingsRuntimeEffectsContract/);
  assert.match(outputChangeSource, /export function buildAudioSettingsOutputChangeContract/);
  assert.match(processingModeSource, /export function buildAudioSettingsProcessingModeContract/);
});
