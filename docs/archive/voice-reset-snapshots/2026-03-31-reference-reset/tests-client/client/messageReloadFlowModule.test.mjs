import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message reload flow delegates state and deferred sync helpers through dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageReloadFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageReloadStateFlow\.mjs'/);
  assert.match(source, /from '\.\/messageReloadDeferredSyncFlow\.mjs'/);
  assert.match(source, /function runMessageReloadFlow\(/);
  assert.doesNotMatch(source, /function commitReloadedConversationState\(/);
  assert.doesNotMatch(source, /function scheduleDeferredRoomSenderKeySync\(/);
});
