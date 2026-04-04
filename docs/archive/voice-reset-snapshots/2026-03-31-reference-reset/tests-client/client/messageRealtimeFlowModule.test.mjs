import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message realtime flow delegates incoming and lifecycle helpers through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRealtimeFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageIncomingConversationFlow\.mjs'/);
  assert.match(source, /from '\.\/messageConversationLifecycleFlow\.mjs'/);
  assert.doesNotMatch(source, /function processIncomingConversationMessage\(/);
  assert.doesNotMatch(source, /function applyEditedConversationMessage\(/);
});
