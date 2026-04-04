import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation lifecycle flow owns edit and delete state mutations', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationLifecycleFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function applyEditedConversationMessage\(/);
  assert.match(source, /function applyDeletedConversationMessage\(/);
  assert.doesNotMatch(source, /function processIncomingConversationMessage\(/);
});
