import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message reload deferred sync flow owns deferred sender-key scheduling and delay constants', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageReloadDeferredSyncFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS = 3000/);
  assert.match(source, /function scheduleDeferredRoomSenderKeySync\(/);
  assert.doesNotMatch(source, /function commitReloadedConversationState\(/);
});
