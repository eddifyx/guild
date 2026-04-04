import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message pending decrypt flow owns delay and expiry helpers for visible conversation decrypt state', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messagePendingDecryptFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function getPendingDecryptVisibilityDelay\(/);
  assert.match(source, /function expirePendingDecryptMessages\(/);
  assert.doesNotMatch(source, /function retryFailedConversationMessages\(/);
  assert.doesNotMatch(source, /function collectRetryableConversationMessages\(/);
});
