import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice encryption module aligns secure-media support checks with the encoded-stream APIs it actually attaches', async () => {
  const source = await readFile(
    new URL('../../../client/src/crypto/voiceEncryption.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function isSenderInsertableStreamsSupported/);
  assert.match(source, /globalThis\.RTCRtpSender/);
  assert.match(source, /createEncodedStreams/);
  assert.match(source, /export function isReceiverInsertableStreamsSupported/);
  assert.match(source, /globalThis\.RTCRtpReceiver/);
  assert.match(source, /return isSenderInsertableStreamsSupported\(\) && isReceiverInsertableStreamsSupported\(\);/);
});

test('voice encryption module reports false when sender or receiver secure transforms cannot attach', async () => {
  const source = await readFile(
    new URL('../../../client/src/crypto/voiceEncryption.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function attachSenderEncryption/);
  assert.match(source, /if \(!sender\) return false;/);
  assert.match(source, /typeof sender\.createEncodedStreams !== 'function'/);
  assert.match(source, /return false;/);
  assert.match(source, /export function attachReceiverDecryption/);
  assert.match(source, /if \(!receiver\) return false;/);
  assert.match(source, /typeof receiver\.createEncodedStreams !== 'function'/);
});
