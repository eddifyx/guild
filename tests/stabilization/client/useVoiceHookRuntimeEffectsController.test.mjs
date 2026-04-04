import test from 'node:test';
import assert from 'node:assert/strict';

test('voice hook runtime effects controller wrapper imports cleanly', async () => {
  const module = await import('../../../client/src/features/voice/useVoiceHookRuntimeEffectsController.mjs');

  assert.equal(typeof module.useVoiceHookRuntimeEffectsController, 'function');
});
