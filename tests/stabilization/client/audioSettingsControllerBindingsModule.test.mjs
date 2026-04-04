import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller bindings hub delegates to dedicated binding modules', async () => {
  const hubSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsControllerBindings.mjs', import.meta.url),
    'utf8'
  );
  const monitorSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsMonitorBindings.mjs', import.meta.url),
    'utf8'
  );
  const appleSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsAppleIsolationBindings.mjs', import.meta.url),
    'utf8'
  );
  const micTestSource = await readFile(
    new URL('../../../client/src/features/voice/audioSettingsMicTestBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /audioSettingsMonitorBindings/);
  assert.match(hubSource, /audioSettingsAppleIsolationBindings/);
  assert.match(hubSource, /audioSettingsMicTestBindings/);
  assert.match(monitorSource, /export function buildAudioSettingsMonitorOutputOptions/);
  assert.match(appleSource, /export function buildAudioSettingsAppleIsolationDeps/);
  assert.match(micTestSource, /audioSettingsMicTestStartOptions/);
  assert.match(micTestSource, /audioSettingsMicTestStartHandlerOptions/);
  assert.match(micTestSource, /audioSettingsMicTestDeps/);
});
