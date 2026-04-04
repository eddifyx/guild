import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message mutation transport flow owns edit and delete socket actions', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageMutationTransportFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createEditMessageAction\(/);
  assert.match(source, /function createDeleteMessageAction\(/);
  assert.match(source, /socket\.emit\('message:edit'/);
  assert.match(source, /socket\.emit\('message:delete'/);
  assert.doesNotMatch(source, /function createLoadMoreMessagesAction\(/);
});
