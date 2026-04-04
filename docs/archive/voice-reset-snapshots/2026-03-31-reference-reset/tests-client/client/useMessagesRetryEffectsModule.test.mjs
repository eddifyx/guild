import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages retry effects delegate binding and action lanes to dedicated hooks', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesRetryEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/useMessagesRetryBindingEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesRetryActionEffects\.mjs'/);
  assert.match(source, /useMessagesRetryBindingEffects\(/);
  assert.match(source, /useMessagesRetryActionEffects\(/);
  assert.doesNotMatch(source, /retryFailedVisibleRoomMessagesRef\.current = retryFailedVisibleRoomMessagesFn/);
  assert.doesNotMatch(source, /bindRoomSenderKeyRetryFn\(/);
  assert.doesNotMatch(source, /schedulePendingDecryptExpiryFn\(/);
  assert.doesNotMatch(source, /shouldRetryFailedDMConversationMessagesFn\(/);
  assert.doesNotMatch(source, /reloadMessagesFn\(\)/);
});
