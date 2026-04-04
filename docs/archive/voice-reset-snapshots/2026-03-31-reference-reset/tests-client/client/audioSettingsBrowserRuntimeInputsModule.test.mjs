import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings browser runtime inputs hub delegates to graph and warmup input owners', async () => {
  const hubModule = await import('../../../client/src/features/voice/audioSettingsBrowserRuntimeInputs.mjs');
  const graphModule = await import('../../../client/src/features/voice/audioSettingsBrowserGraphInput.mjs');
  const warmupModule = await import('../../../client/src/features/voice/audioSettingsBrowserWarmupInput.mjs');

  assert.equal(typeof hubModule.buildAudioSettingsBrowserGraphInput, 'function');
  assert.equal(typeof hubModule.buildAudioSettingsBrowserWarmupInput, 'function');
  assert.equal(
    hubModule.buildAudioSettingsBrowserGraphInput,
    graphModule.buildAudioSettingsBrowserGraphInput
  );
  assert.equal(
    hubModule.buildAudioSettingsBrowserWarmupInput,
    warmupModule.buildAudioSettingsBrowserWarmupInput
  );
});
