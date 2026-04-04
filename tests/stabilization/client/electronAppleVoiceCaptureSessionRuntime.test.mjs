import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  buildAppleVoiceCaptureReadyMetadata,
  clearAppleVoiceCaptureFirstFrameTimeout,
  createAppleVoiceCaptureSessionState,
  prepareAppleVoiceCaptureSessionForStop,
  readAppleVoiceJsonLine,
} = require('../../../client/electron/appleVoiceCaptureSessionRuntime.js');

test('electron apple voice capture session runtime parses lines and builds canonical ready metadata', () => {
  assert.deepEqual(readAppleVoiceJsonLine('{"type":"ready","sampleRate":44100}'), {
    type: 'ready',
    sampleRate: 44100,
  });
  assert.equal(readAppleVoiceJsonLine('not-json'), null);
  assert.deepEqual(buildAppleVoiceCaptureReadyMetadata({
    sampleRate: 44100,
    channels: 2,
    frameSamples: 512,
    voiceProcessingEnabled: false,
    advancedOtherAudioDucking: false,
    otherAudioDuckingLevel: 10,
    inputSampleRate: 48000,
    inputChannels: 1,
    configuration: 'duplex',
  }), {
    backend: 'apple-voice-processing',
    sampleRate: 44100,
    channels: 2,
    frameSamples: 512,
    voiceProcessingEnabled: false,
    advancedOtherAudioDucking: false,
    otherAudioDuckingLevel: 10,
    inputSampleRate: 48000,
    inputChannels: 1,
    configuration: 'duplex',
  });
});

test('electron apple voice capture session runtime creates state, applies ready payloads, and emits framed audio', () => {
  const proc = {};
  const sessionState = createAppleVoiceCaptureSessionState(proc);
  const metadata = applyAppleVoiceCaptureReadyPayload(sessionState, {
    sampleRate: 32000,
    channels: 1,
    frameSamples: 4,
    configuration: 'mono',
  });

  assert.equal(sessionState.proc, proc);
  assert.equal(sessionState.ready, true);
  assert.equal(sessionState.frameBytes, 8);
  assert.equal(metadata.configuration, 'mono');

  const cleared = [];
  const frames = [];
  let firstFrameCount = 0;
  sessionState.firstFrameTimeout = { id: 'timeout-1' };

  const firstChunk = Buffer.from([1, 2, 3, 4]);
  assert.equal(
    appendAppleVoiceCaptureFrames(sessionState, firstChunk, {
      clearTimeoutFn(timeout) {
        cleared.push(timeout);
      },
      onFirstFrame() {
        firstFrameCount += 1;
      },
      onFrame(frame) {
        frames.push(Buffer.from(frame));
      },
    }),
    0
  );

  const secondChunk = Buffer.from([5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(
    appendAppleVoiceCaptureFrames(sessionState, secondChunk, {
      clearTimeoutFn(timeout) {
        cleared.push(timeout);
      },
      onFirstFrame() {
        firstFrameCount += 1;
      },
      onFrame(frame) {
        frames.push(Buffer.from(frame));
      },
    }),
    1
  );

  assert.equal(firstFrameCount, 1);
  assert.deepEqual(cleared, [{ id: 'timeout-1' }]);
  assert.equal(sessionState.firstFrameTimeout, null);
  assert.equal(sessionState.firstFrameReceived, true);
  assert.deepEqual(frames, [Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])]);
  assert.deepEqual(sessionState.stdoutBuffer, Buffer.from([9, 10, 11, 12]));
});

test('electron apple voice capture session runtime clears timeout, prepares stop state, and builds ended errors', () => {
  const cleared = [];
  const sessionState = createAppleVoiceCaptureSessionState({ pid: 7 });
  sessionState.stdoutBuffer = Buffer.from([1, 2, 3]);
  sessionState.firstFrameTimeout = { id: 'timeout-2' };

  assert.equal(
    clearAppleVoiceCaptureFirstFrameTimeout(sessionState, {
      clearTimeoutFn(timeout) {
        cleared.push(timeout);
      },
    }),
    true
  );
  assert.equal(sessionState.firstFrameTimeout, null);

  sessionState.firstFrameTimeout = { id: 'timeout-3' };
  prepareAppleVoiceCaptureSessionForStop(sessionState, {
    clearTimeoutFn(timeout) {
      cleared.push(timeout);
    },
  });

  assert.equal(sessionState.stopping, true);
  assert.deepEqual(sessionState.stdoutBuffer, Buffer.alloc(0));
  assert.equal(sessionState.firstFrameTimeout, null);
  assert.deepEqual(cleared, [{ id: 'timeout-2' }, { id: 'timeout-3' }]);
  assert.match(buildAppleVoiceCaptureEndedError('', null, 'SIGTERM').message, /SIGTERM/);
  assert.equal(buildAppleVoiceCaptureEndedError('fatal stderr', null, null).message, 'fatal stderr');
});
