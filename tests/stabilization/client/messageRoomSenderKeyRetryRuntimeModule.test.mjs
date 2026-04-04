import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message room sender-key retry runtime owns sender-key and secure-ready event bindings', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRoomSenderKeyRetryRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function bindRoomSenderKeyRetry\(/);
  assert.match(source, /addEventListener\('sender-key-updated'/);
  assert.match(source, /addEventListener\(E2E_INIT_READY_EVENT/);
  assert.doesNotMatch(source, /function schedulePendingDecryptExpiry\(/);
});
