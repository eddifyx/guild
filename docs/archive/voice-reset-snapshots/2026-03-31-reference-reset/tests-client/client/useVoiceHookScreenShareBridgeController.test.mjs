import test from 'node:test';
import assert from 'node:assert/strict';

test('voice hook screen share bridge controller module imports cleanly and exposes the hook factory', async () => {
  const module = await import('../../../client/src/features/voice/useVoiceHookScreenShareBridgeController.mjs');

  assert.equal(typeof module.useVoiceHookScreenShareBridgeController, 'function');
});
