import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message send state flow owns attachment validation and optimistic message shaping', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageSendStateFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildSecureAttachmentState\(/);
  assert.match(source, /function createOptimisticSecureMessage\(/);
  assert.match(source, /function removeOptimisticMessageByNonce\(/);
  assert.doesNotMatch(source, /function createAckEmitter\(/);
});
