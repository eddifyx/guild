import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation state flow delegates cleanup and hydration helpers through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationStateFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageConversationCleanupFlow\.mjs'/);
  assert.match(source, /from '\.\/messageConversationHydrationFlow\.mjs'/);
  assert.doesNotMatch(source, /function clearAllMessageCaches\(/);
  assert.doesNotMatch(source, /function hydrateConversationState\(/);
});
