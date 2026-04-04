import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message runtime contracts own runtime-level cache, retry, and subscription contract shaping', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRuntimeContracts.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildUseMessagesRuntimeContracts\(/);
  assert.match(source, /clearAllMessageCachesFn: \(\) => clearAllMessageCachesFn\(/);
  assert.doesNotMatch(source, /function buildUseMessagesFlowContracts\(/);
});
