import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller delegates state, view-state, and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsController.mjs', import.meta.url),
    'utf8'
  );
  const compositionSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerState.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useAudioSettingsControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useAudioSettingsControllerState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useAudioSettingsControllerViewState\.mjs'/);
  assert.match(controllerSource, /useAudioSettingsControllerState\(/);
  assert.match(controllerSource, /useAudioSettingsControllerViewState\(/);
  assert.match(controllerSource, /useAudioSettingsControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /useAudioSettingsControllerRuntime\(/);
  assert.doesNotMatch(controllerSource, /buildAudioSettingsControllerState\(/);
  assert.doesNotMatch(controllerSource, /buildAudioSettingsViewState\(/);
  assert.doesNotMatch(controllerSource, /const \[testing, setTesting\] = useState\(/);

  assert.match(compositionSource, /useAudioSettingsControllerRuntime\(/);
  assert.match(stateSource, /function useAudioSettingsControllerState\(/);
  assert.match(viewStateSource, /function useAudioSettingsControllerViewState\(/);
});
