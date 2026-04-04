import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages state effects delegate reset and hydration lanes to dedicated hooks', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesStateEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/useMessagesResetEffects\.mjs'/);
  assert.match(source, /from '\.\/useMessagesHydrationEffects\.mjs'/);
  assert.match(source, /useMessagesResetEffects\(/);
  assert.match(source, /useMessagesHydrationEffects\(/);
  assert.doesNotMatch(source, /messagesRef\.current = messages/);
  assert.doesNotMatch(source, /resetMessageLaneStateFn\(/);
  assert.doesNotMatch(source, /hydrateConversationStateFn\(/);
  assert.doesNotMatch(source, /persistReadableConversationMessagesFn\(/);
});
