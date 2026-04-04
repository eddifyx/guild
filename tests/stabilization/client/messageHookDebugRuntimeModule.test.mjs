import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message hook debug runtime owns room-open logging through the electron bridge', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageHookDebugRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createDebugRoomOpenLogger\(/);
  assert.match(source, /electronAPI\?\.debugLog/);
  assert.doesNotMatch(source, /createTryDecryptMessage\(/);
  assert.doesNotMatch(source, /createFetchConversationMessages\(/);
});
