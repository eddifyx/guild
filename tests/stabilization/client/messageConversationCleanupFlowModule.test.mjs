import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message conversation cleanup flow owns preview revocation, cache clearing, and lane reset helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageConversationCleanupFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function revokeAttachmentPreviewUrls\(/);
  assert.match(source, /function clearConversationMessages\(/);
  assert.match(source, /function clearAllMessageCaches\(/);
  assert.match(source, /function resetMessageLaneState\(/);
  assert.doesNotMatch(source, /function hydrateConversationState\(/);
  assert.doesNotMatch(source, /function persistReadableConversationMessages\(/);
});
