import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message hook fetch dependencies own sender-key sync, fetch, and room warm-cache builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageHookFetchDependencies.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createSyncConversationRoomSenderKeys\(/);
  assert.match(source, /function createFetchConversationMessages\(/);
  assert.match(source, /function createWarmRoomMessageCache\(/);
  assert.match(source, /syncConversationRoomSenderKeysFlowFn/);
  assert.match(source, /fetchConversationMessagesFlowFn/);
  assert.match(source, /warmRoomMessageCacheFlowFn/);
  assert.doesNotMatch(source, /createTryDecryptMessage\(/);
  assert.doesNotMatch(source, /createDebugRoomOpenLogger\(/);
});
