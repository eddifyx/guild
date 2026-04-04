import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages retry binding effects own dm and room retry bindings plus pending expiry scheduling', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesRetryBindingEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesRetryBindingEffects\(/);
  assert.match(source, /bindDMDecryptRetryFn\(/);
  assert.match(source, /retryFailedVisibleRoomMessagesRef\.current = retryFailedVisibleRoomMessagesFn/);
  assert.match(source, /bindRoomSenderKeyRetryFn\(/);
  assert.match(source, /schedulePendingDecryptExpiryFn\(/);
});
