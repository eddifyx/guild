import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message fetch flow delegates conversation fetch and warm-cache helpers through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageFetchFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageConversationFetchFlow\.mjs'/);
  assert.match(source, /from '\.\/messageRoomWarmFlow\.mjs'/);
  assert.doesNotMatch(source, /function fetchConversationMessages\(/);
  assert.doesNotMatch(source, /function warmRoomMessageCache\(/);
});
