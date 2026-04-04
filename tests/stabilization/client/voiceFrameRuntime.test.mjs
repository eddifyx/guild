import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptVoiceFrameData,
  encryptVoiceFrameData,
  getVoiceUnencryptedHeaderBytes,
  normalizeVoiceFrameDataForEncryption,
  selectVoiceFrameDecryptionState,
  shouldFailOpenVoiceAudio,
  stripAv1TemporalDelimiterObus,
} from '../../../client/src/features/crypto/voiceFrameRuntime.mjs';

function createFrame(data, mimeType) {
  return {
    data: Uint8Array.from(data).buffer,
    getMetadata() {
      return { mimeType };
    },
  };
}

test('voice frame runtime strips AV1 temporal delimiter OBUs before encryption shaping', () => {
  const av1Data = Uint8Array.from([
    0x12, 0x00,
    0x12, 0x00,
    0xaa, 0xbb, 0xcc,
  ]);
  const stripped = stripAv1TemporalDelimiterObus(av1Data);
  assert.deepEqual(Array.from(stripped), [0xaa, 0xbb, 0xcc]);

  const normalized = normalizeVoiceFrameDataForEncryption(
    av1Data,
    createFrame(av1Data, 'video/av1'),
    {},
  );
  assert.deepEqual(Array.from(normalized), [0xaa, 0xbb, 0xcc]);
});

test('voice frame runtime derives header bytes and fail-open policy from codec metadata', () => {
  const audioFrame = createFrame([0x11, 0x22, 0x33], 'audio/opus');
  const h264Frame = createFrame([1, 2, 3, 4, 5, 6, 7], 'video/h264');
  const unknownVideoFrame = createFrame(new Array(20).fill(0xaa), '');

  assert.equal(getVoiceUnencryptedHeaderBytes(audioFrame), 1);
  assert.equal(getVoiceUnencryptedHeaderBytes(h264Frame), 5);
  assert.equal(getVoiceUnencryptedHeaderBytes(unknownVideoFrame, { kind: 'video' }), 10);

  assert.equal(shouldFailOpenVoiceAudio({
    frame: audioFrame,
    failOpenAudio: true,
  }), true);
  assert.equal(shouldFailOpenVoiceAudio({
    frame: h264Frame,
    failOpenAudio: true,
  }), false);
});

test('voice frame runtime encrypts and decrypts using current and previous key epochs', () => {
  const currentKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const previousKey = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
  const frame = createFrame([0xab, 1, 2, 3, 4, 5, 6], 'audio/opus');
  const previousFrame = createFrame([0xcd, 9, 8, 7, 6, 5, 4], 'audio/opus');

  const encryptedCurrent = encryptVoiceFrameData({
    frameData: frame.data,
    frame,
    key: currentKey,
    epoch: 7,
    channelId: 'voice-1',
  });
  const decryptedCurrent = decryptVoiceFrameData({
    frameData: encryptedCurrent.buffer,
    frame,
    channelId: 'voice-1',
    currentKey,
    currentEpoch: 7,
    previousKey,
    previousEpoch: 6,
  });
  assert.deepEqual(Array.from(decryptedCurrent), [0xab, 1, 2, 3, 4, 5, 6]);

  const encryptedPrevious = encryptVoiceFrameData({
    frameData: previousFrame.data,
    frame: previousFrame,
    key: previousKey,
    epoch: 6,
    channelId: 'voice-1',
  });
  const decryptedPrevious = decryptVoiceFrameData({
    frameData: encryptedPrevious.buffer,
    frame: previousFrame,
    channelId: 'voice-1',
    currentKey,
    currentEpoch: 7,
    previousKey,
    previousEpoch: 6,
  });
  assert.deepEqual(Array.from(decryptedPrevious), [0xcd, 9, 8, 7, 6, 5, 4]);
});

test('voice frame runtime selects decryption state predictably for current, previous, and retry paths', () => {
  const currentKey = Uint8Array.of(1);
  const previousKey = Uint8Array.of(2);

  assert.deepEqual(
    selectVoiceFrameDecryptionState({
      frameEpoch: 4,
      currentKey,
      currentEpoch: 4,
      previousKey,
      previousEpoch: 3,
    }),
    {
      key: currentKey,
      epoch: 4,
      shouldRetryPreviousKey: false,
    },
  );

  assert.deepEqual(
    selectVoiceFrameDecryptionState({
      frameEpoch: 3,
      currentKey,
      currentEpoch: 4,
      previousKey,
      previousEpoch: 3,
    }),
    {
      key: previousKey,
      epoch: 3,
      shouldRetryPreviousKey: false,
    },
  );

  assert.deepEqual(
    selectVoiceFrameDecryptionState({
      frameEpoch: 2,
      currentKey,
      currentEpoch: 4,
      previousKey,
      previousEpoch: 3,
    }),
    {
      key: currentKey,
      epoch: 4,
      shouldRetryPreviousKey: true,
    },
  );
});
