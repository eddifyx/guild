import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller composition owns runtime orchestration and controller-state assembly', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerComposition.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useAudioSettingsControllerComposition\(/);
  assert.match(compositionSource, /useAudioSettingsControllerRuntime\(/);
  assert.match(compositionSource, /buildAudioSettingsControllerState\(/);
});
