import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings mic-test action modules import cleanly and expose stable builders', async () => {
  const coreModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestCoreActions.mjs');
  const flowModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestFlowActions.mjs');
  const stopModule = await import('../../../client/src/features/voice/audioSettingsControllerStopTestAction.mjs');
  const appleModule = await import('../../../client/src/features/voice/audioSettingsControllerAppleIsolationAction.mjs');
  const startModule = await import('../../../client/src/features/voice/audioSettingsControllerStartTestAction.mjs');
  const restartModule = await import('../../../client/src/features/voice/audioSettingsControllerRestartTestAction.mjs');
  const actionsModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestActions.mjs');

  assert.equal(typeof coreModule.buildAudioSettingsControllerMicTestCoreActions, 'function');
  assert.equal(typeof flowModule.buildAudioSettingsControllerMicTestFlowActions, 'function');
  assert.equal(typeof stopModule.buildAudioSettingsControllerStopTestAction, 'function');
  assert.equal(typeof appleModule.buildAudioSettingsControllerAppleIsolationAction, 'function');
  assert.equal(typeof startModule.buildAudioSettingsControllerStartTestAction, 'function');
  assert.equal(typeof restartModule.buildAudioSettingsControllerRestartTestAction, 'function');
  assert.equal(typeof actionsModule.buildAudioSettingsControllerMicTestActions, 'function');
});
