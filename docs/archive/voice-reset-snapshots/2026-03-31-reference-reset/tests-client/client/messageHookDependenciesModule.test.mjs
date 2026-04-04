import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message hook dependencies delegate exports to dedicated helper owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageHookDependencies.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageHookDebugRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageHookDecryptDependencies\.mjs'/);
  assert.match(source, /from '\.\/messageHookFetchDependencies\.mjs'/);
  assert.doesNotMatch(source, /function createDebugRoomOpenLogger\(/);
  assert.doesNotMatch(source, /function createTryDecryptMessage\(/);
  assert.doesNotMatch(source, /function createFetchConversationMessages\(/);
});
