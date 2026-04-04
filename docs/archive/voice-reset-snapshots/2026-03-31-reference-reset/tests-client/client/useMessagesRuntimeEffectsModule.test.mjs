import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages runtime effects delegates state, retry, and subscription lanes to dedicated hooks', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesRuntimeEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/useMessagesStateEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesRetryEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesSubscriptionEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesDecryptDebugLogEffect\.mjs'/);
  assert.match(source, /from '\.\/useMessagesDebugSurfaceEffect\.mjs'/);
  assert.match(source, /useMessagesStateEffects\(/);
  assert.match(source, /useMessagesRetryEffects\(/);
  assert.match(source, /useMessagesSubscriptionEffects\(/);
  assert.match(source, /useMessagesDecryptDebugLogEffect\(/);
  assert.match(source, /useMessagesDebugSurfaceEffect\(/);
  assert.doesNotMatch(source, /resetMessageLaneStateFn\(/);
  assert.doesNotMatch(source, /schedulePendingDecryptExpiryFn\(/);
  assert.doesNotMatch(source, /subscribeConversationRealtimeFn\(/);
});
