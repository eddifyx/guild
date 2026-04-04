import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message realtime subscription flow owns realtime socket subscription wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRealtimeSubscriptionFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function subscribeConversationRealtime\(/);
  assert.match(source, /socket\.on\(eventName, handler\)/);
  assert.doesNotMatch(source, /function subscribeConversationLifecycle\(/);
});
