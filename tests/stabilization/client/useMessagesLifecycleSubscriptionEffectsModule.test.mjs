import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages lifecycle subscription effects own lifecycle option shaping and subscription wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesLifecycleSubscriptionEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesLifecycleSubscriptionEffects\(/);
  assert.match(source, /subscribeConversationLifecycleFn\(/);
  assert.match(source, /buildConversationLifecycleOptionsFn\(/);
});
