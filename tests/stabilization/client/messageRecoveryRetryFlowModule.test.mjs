import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message recovery retry flow owns retry orchestration and delegates selection helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRecoveryRetryFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageRecoverySelectionFlow\.mjs'/);
  assert.match(source, /function retryFailedConversationMessages\(/);
  assert.doesNotMatch(source, /function collectRetryableConversationMessages\(/);
  assert.doesNotMatch(source, /function getPendingDecryptVisibilityDelay\(/);
});
