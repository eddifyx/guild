import test from 'node:test';
import assert from 'node:assert/strict';

test('message input runtime hook imports cleanly and exposes a hook factory', async () => {
  const { useMessageInputRuntimeEffects } = await import('../../../client/src/features/messaging/useMessageInputRuntimeEffects.mjs');
  assert.equal(typeof useMessageInputRuntimeEffects, 'function');
});
