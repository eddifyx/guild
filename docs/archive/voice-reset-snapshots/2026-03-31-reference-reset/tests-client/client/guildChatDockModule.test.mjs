import test from 'node:test';
import assert from 'node:assert/strict';

test('guild chat dock controller modules import cleanly and expose hook factories', async () => {
  const { useGuildChatDockControllerRuntime } = await import('../../../client/src/features/messaging/useGuildChatDockControllerRuntime.mjs');
  const { useGuildChatDockRuntimeEffects } = await import('../../../client/src/features/messaging/useGuildChatDockRuntimeEffects.mjs');
  assert.equal(typeof useGuildChatDockControllerRuntime, 'function');
  assert.equal(typeof useGuildChatDockRuntimeEffects, 'function');
});
