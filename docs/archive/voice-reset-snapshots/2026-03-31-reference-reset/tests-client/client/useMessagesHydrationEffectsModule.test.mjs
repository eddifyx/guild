import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages hydration effects own conversation hydration and readable-message persistence', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesHydrationEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesHydrationEffects\(/);
  assert.match(source, /hydrateConversationStateFn\(/);
  assert.match(source, /persistReadableConversationMessagesFn\(/);
});
