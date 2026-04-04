import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages retry action effects own dm retry and reload triggers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesRetryActionEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesRetryActionEffects\(/);
  assert.match(source, /useRef/);
  assert.match(source, /getConversationEffectKey/);
  assert.match(source, /shouldRetryFailedDMConversationMessages/);
  assert.match(source, /retryFailedVisibleMessagesRef\.current\(\)/);
  assert.match(source, /reloadMessagesRef\.current\(\)/);
  assert.doesNotMatch(source, /conversation,\s*reloadMessagesFn/);
  assert.doesNotMatch(source, /conversation\.npub/);
  assert.doesNotMatch(source, /conversation\.collapsing/);
});
