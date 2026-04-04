import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings apple runtime contracts hub delegates to dedicated owners', async () => {
  const hubModule = await import('../../../client/src/features/voice/audioSettingsAppleRuntimeContracts.mjs');
  const cleanupModule = await import('../../../client/src/features/voice/audioSettingsAppleCleanupInput.mjs');
  const successModule = await import('../../../client/src/features/voice/audioSettingsAppleSuccessDiagnostics.mjs');
  const fallbackModule = await import('../../../client/src/features/voice/audioSettingsAppleStateFallbackUpdater.mjs');

  assert.equal(typeof hubModule.buildAudioSettingsAppleCleanupInput, 'function');
  assert.equal(typeof hubModule.buildAudioSettingsAppleSuccessDiagnostics, 'function');
  assert.equal(typeof hubModule.buildAudioSettingsAppleStateFallbackUpdater, 'function');
  assert.equal(
    hubModule.buildAudioSettingsAppleCleanupInput,
    cleanupModule.buildAudioSettingsAppleCleanupInput
  );
  assert.equal(
    hubModule.buildAudioSettingsAppleSuccessDiagnostics,
    successModule.buildAudioSettingsAppleSuccessDiagnostics
  );
  assert.equal(
    hubModule.buildAudioSettingsAppleStateFallbackUpdater,
    fallbackModule.buildAudioSettingsAppleStateFallbackUpdater
  );
});
