import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings mic-test bindings hub delegates to dedicated option owners', async () => {
  const hubModule = await import('../../../client/src/features/voice/audioSettingsMicTestBindings.mjs');
  const startOptionsModule = await import('../../../client/src/features/voice/audioSettingsMicTestStartOptions.mjs');
  const startHandlerOptionsModule = await import('../../../client/src/features/voice/audioSettingsMicTestStartHandlerOptions.mjs');
  const depsModule = await import('../../../client/src/features/voice/audioSettingsMicTestDeps.mjs');

  assert.equal(typeof hubModule.buildAudioSettingsMicTestStartOptions, 'function');
  assert.equal(typeof hubModule.buildAudioSettingsMicTestStartHandlerOptions, 'function');
  assert.equal(typeof hubModule.buildAudioSettingsMicTestDeps, 'function');
  assert.equal(
    hubModule.buildAudioSettingsMicTestStartOptions,
    startOptionsModule.buildAudioSettingsMicTestStartOptions
  );
  assert.equal(
    hubModule.buildAudioSettingsMicTestStartHandlerOptions,
    startHandlerOptionsModule.buildAudioSettingsMicTestStartHandlerOptions
  );
  assert.equal(
    hubModule.buildAudioSettingsMicTestDeps,
    depsModule.buildAudioSettingsMicTestDeps
  );
});
