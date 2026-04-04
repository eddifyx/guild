import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message reload state flow owns unsupported-dm, message-count, and commit helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageReloadStateFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function handleUnsupportedConversationReload\(/);
  assert.match(source, /function getCurrentConversationMessageCount\(/);
  assert.match(source, /function commitReloadedConversationState\(/);
  assert.doesNotMatch(source, /function scheduleDeferredRoomSenderKeySync\(/);
});
