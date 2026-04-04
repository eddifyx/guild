import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message recovery flow delegates selection, retry, and pending decrypt helpers through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRecoveryFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageRecoverySelectionFlow\.mjs'/);
  assert.match(source, /from '\.\/messageRecoveryRetryFlow\.mjs'/);
  assert.match(source, /from '\.\/messagePendingDecryptFlow\.mjs'/);
  assert.doesNotMatch(source, /function collectRetryableConversationMessages\(/);
  assert.doesNotMatch(source, /function retryFailedConversationMessages\(/);
  assert.doesNotMatch(source, /function getPendingDecryptVisibilityDelay\(/);
});
