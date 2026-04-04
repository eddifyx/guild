import test from 'node:test';
import assert from 'node:assert/strict';

test('voice hook action controller wrappers import cleanly', async () => {
  const sessionModule = await import('../../../client/src/features/voice/useVoiceHookSessionActionsController.mjs');
  const uiModule = await import('../../../client/src/features/voice/useVoiceHookUiActionsController.mjs');

  assert.equal(typeof sessionModule.useVoiceHookSessionActionsController, 'function');
  assert.equal(typeof uiModule.useVoiceHookUiActionsController, 'function');
});
