import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message hook decrypt dependencies own try-decrypt and bulk-decrypt helper builders', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageHookDecryptDependencies.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createTryDecryptMessage\(/);
  assert.match(source, /function createDecryptMessages\(/);
  assert.match(source, /tryDecryptConversationMessageFn/);
  assert.match(source, /decryptConversationMessagesFn/);
  assert.doesNotMatch(source, /createFetchConversationMessages\(/);
  assert.doesNotMatch(source, /createWarmRoomMessageCache\(/);
});
