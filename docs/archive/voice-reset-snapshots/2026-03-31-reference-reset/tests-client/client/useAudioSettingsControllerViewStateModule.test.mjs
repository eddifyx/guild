import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller delegates view-state derivation to a dedicated hook', async () => {
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(viewStateSource, /function useAudioSettingsControllerViewState\(/);
  assert.match(viewStateSource, /buildAudioSettingsViewState\(/);
  assert.match(viewStateSource, /getPreferredNoiseSuppressionImplementation\(/);
  assert.match(viewStateSource, /getAppleHardwareProcessingGuidance\(/);
});
