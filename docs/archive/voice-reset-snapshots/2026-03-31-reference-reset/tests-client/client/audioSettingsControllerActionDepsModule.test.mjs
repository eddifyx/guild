import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings controller action deps split modules import cleanly and expose stable resolvers', async () => {
  const depsModule = await import('../../../client/src/features/voice/audioSettingsControllerActionDeps.mjs');
  const micTestDepsModule = await import('../../../client/src/features/voice/audioSettingsControllerMicTestActionDeps.mjs');
  const interactionDepsModule = await import('../../../client/src/features/voice/audioSettingsControllerInteractionActionDeps.mjs');

  assert.equal(typeof depsModule.resolveAudioSettingsControllerActionDeps, 'function');
  assert.equal(typeof micTestDepsModule.resolveAudioSettingsControllerMicTestActionDeps, 'function');
  assert.equal(typeof interactionDepsModule.resolveAudioSettingsControllerInteractionActionDeps, 'function');
});
