import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message recovery runtime delegates DM retry, room retry, and pending-expiry helpers through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageRecoveryRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageDmDecryptRetryRuntime\.mjs'/);
  assert.match(source, /from '\.\/messageRoomSenderKeyRetryRuntime\.mjs'/);
  assert.match(source, /from '\.\/messagePendingDecryptExpiryRuntime\.mjs'/);
  assert.doesNotMatch(source, /function bindDMDecryptRetry\(/);
  assert.doesNotMatch(source, /function bindRoomSenderKeyRetry\(/);
  assert.doesNotMatch(source, /function schedulePendingDecryptExpiry\(/);
});
