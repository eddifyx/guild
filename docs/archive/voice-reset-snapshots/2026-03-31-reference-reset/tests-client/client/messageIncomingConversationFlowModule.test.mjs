import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message incoming conversation flow owns conversation matching and incoming message finalization', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageIncomingConversationFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function isIncomingMessageForConversation\(/);
  assert.match(source, /function processIncomingConversationMessage\(/);
  assert.doesNotMatch(source, /function applyEditedConversationMessage\(/);
});
