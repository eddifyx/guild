import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message subscription flow delegates realtime and lifecycle subscriptions through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageSubscriptionFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageRealtimeSubscriptionFlow\.mjs'/);
  assert.match(source, /from '\.\/messageLifecycleSubscriptionFlow\.mjs'/);
  assert.doesNotMatch(source, /function subscribeConversationRealtime\(/);
  assert.doesNotMatch(source, /function subscribeConversationLifecycle\(/);
});
