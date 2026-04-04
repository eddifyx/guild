import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message send flow delegates ack and state helpers through dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageSendFlow.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageSendAckFlow\.mjs'/);
  assert.match(source, /from '\.\/messageSendStateFlow\.mjs'/);
  assert.match(source, /function createMessageSendAction\(/);
  assert.doesNotMatch(source, /function createAckEmitter\(/);
  assert.doesNotMatch(source, /function buildSecureAttachmentState\(/);
});
