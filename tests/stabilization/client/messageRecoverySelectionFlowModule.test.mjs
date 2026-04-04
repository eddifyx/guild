import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message recovery selection flow owns retry collection, room prioritization, and DM retry gating helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRecoverySelectionFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function collectRetryableConversationMessages\(/);
  assert.match(source, /function prioritizeRoomRecoveryMessages\(/);
  assert.match(source, /function shouldRetryFailedDMConversationMessages\(/);
  assert.doesNotMatch(source, /function retryFailedConversationMessages\(/);
  assert.doesNotMatch(source, /function getPendingDecryptVisibilityDelay\(/);
});
