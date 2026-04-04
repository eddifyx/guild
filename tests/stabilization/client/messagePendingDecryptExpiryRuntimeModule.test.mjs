import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message pending decrypt expiry runtime owns timer scheduling and expiry commits', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messagePendingDecryptExpiryRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function schedulePendingDecryptExpiry\(/);
  assert.match(source, /setTimeoutFn\(/);
  assert.doesNotMatch(source, /function bindRoomSenderKeyRetry\(/);
});
