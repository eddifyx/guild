import test from 'node:test';
import assert from 'node:assert/strict';

test('sidebar runtime hook imports cleanly and exposes a hook factory', async () => {
  const { useSidebarRuntimeEffects } = await import('../../../client/src/features/layout/useSidebarRuntimeEffects.mjs');
  assert.equal(typeof useSidebarRuntimeEffects, 'function');
});
