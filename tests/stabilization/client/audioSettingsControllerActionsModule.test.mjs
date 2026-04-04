import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings controller action split modules import cleanly and expose stable builders', async () => {
  const depsModule = await import('../../../client/src/features/voice/audioSettingsControllerActionDeps.mjs');
  const micTestDepsModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestActionDeps.mjs');
  const interactionDepsModule = await import('../../../client/src/features/voice/audioSettingsControllerInteractionActionDeps.mjs');
  const micTestModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestActions.mjs');
  const interactionModule = await import('../../../client/src/features/voice/audioSettingsControllerInteractionActions.mjs');
  const actionsModule = await import('../../../client/src/features/voice/audioSettingsControllerActions.mjs');

  assert.equal(typeof depsModule.resolveAudioSettingsControllerActionDeps, 'function');
  assert.equal(typeof micTestDepsModule.resolveAudioSettingsControllerMicTestActionDeps, 'function');
  assert.equal(typeof interactionDepsModule.resolveAudioSettingsControllerInteractionActionDeps, 'function');
  assert.equal(typeof micTestModule.buildAudioSettingsControllerMicTestActions, 'function');
  assert.equal(typeof interactionModule.buildAudioSettingsControllerInteractionActions, 'function');
  assert.equal(typeof actionsModule.createAudioSettingsControllerActions, 'function');
});
