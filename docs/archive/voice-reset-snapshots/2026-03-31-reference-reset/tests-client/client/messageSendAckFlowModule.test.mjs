import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message send ack flow owns timeout constants and socket ack wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageSendAckFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /MESSAGE_SEND_TIMEOUT_MS = 10_000/);
  assert.match(source, /function createAckEmitter\(/);
  assert.match(source, /socket\.emit\(/);
  assert.doesNotMatch(source, /function buildSecureAttachmentState\(/);
});
