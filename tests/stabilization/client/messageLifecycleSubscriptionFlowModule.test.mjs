import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message lifecycle subscription flow owns edit and delete lifecycle socket wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageLifecycleSubscriptionFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function subscribeConversationLifecycle\(/);
  assert.match(source, /socket\.on\('message:edited', handleEdited\)/);
  assert.match(source, /socket\.on\('message:deleted', handleDeleted\)/);
  assert.doesNotMatch(source, /function subscribeConversationRealtime\(/);
});
