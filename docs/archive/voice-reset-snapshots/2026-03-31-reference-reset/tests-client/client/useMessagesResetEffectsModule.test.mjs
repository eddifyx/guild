import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages reset effects own ref sync, lane reset, and deferred sync cleanup', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesResetEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesResetEffects\(/);
  assert.match(source, /messagesRef\.current = messages/);
  assert.match(source, /resetMessageLaneStateFn\(/);
  assert.match(source, /clearDeferredRoomSenderKeySyncFn\(\)/);
});
