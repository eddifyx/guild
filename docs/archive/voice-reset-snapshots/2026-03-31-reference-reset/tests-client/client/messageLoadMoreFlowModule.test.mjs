import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message load-more flow owns pagination, prepend, and cache commit wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageLoadMoreFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function createLoadMoreMessagesAction\(/);
  assert.match(source, /fetchConversationMessagesFn/);
  assert.match(source, /prependOlderMessagesFn/);
  assert.doesNotMatch(source, /function createEditMessageAction\(/);
});
