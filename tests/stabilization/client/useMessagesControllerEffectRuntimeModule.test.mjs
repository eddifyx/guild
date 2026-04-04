import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages controller effect runtime owns messages effect wiring through the shared runtime effects hook', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesControllerEffectRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesControllerEffectRuntime\(/);
  assert.match(source, /useMessagesRuntimeEffects\(/);
  assert.match(source, /retryFailedVisibleMessagesFn/);
  assert.match(source, /clearDeferredRoomSenderKeySyncFn/);
  assert.doesNotMatch(source, /createMessageControllerActions\(/);
  assert.doesNotMatch(source, /windowObject\.clearTimeout\(/);
});
