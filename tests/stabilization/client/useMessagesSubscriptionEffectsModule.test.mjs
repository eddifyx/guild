import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages subscription effects delegate realtime and lifecycle subscriptions to dedicated hooks', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesSubscriptionEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/useMessagesRealtimeSubscriptionEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesLifecycleSubscriptionEffects\.mjs'/);
  assert.match(source, /useMessagesRealtimeSubscriptionEffects\(/);
  assert.match(source, /useMessagesLifecycleSubscriptionEffects\(/);
  assert.doesNotMatch(source, /subscribeConversationRealtimeFn\(/);
  assert.doesNotMatch(source, /buildConversationRealtimeOptionsFn\(/);
  assert.doesNotMatch(source, /subscribeConversationLifecycleFn\(/);
  assert.doesNotMatch(source, /buildConversationLifecycleOptionsFn\(/);
  assert.doesNotMatch(source, /pendingSentMessagesRef\.current/);
});
