import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages realtime subscription effects own realtime option shaping and subscription wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesRealtimeSubscriptionEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesRealtimeSubscriptionEffects\(/);
  assert.match(source, /subscribeConversationRealtimeFn\(/);
  assert.match(source, /buildConversationRealtimeOptionsFn\(/);
  assert.match(source, /pendingSentMessagesRef\.current/);
});
