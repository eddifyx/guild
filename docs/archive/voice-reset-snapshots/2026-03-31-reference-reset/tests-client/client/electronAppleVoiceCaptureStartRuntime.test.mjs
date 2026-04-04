import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createAppleVoiceCaptureStartRuntime,
} = require('../../../client/electron/appleVoiceCaptureStartRuntime.js');

function createProc() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killCalls = [];
  proc.kill = (signal) => {
    proc.killCalls.push(signal);
  };
  return proc;
}

test('electron apple voice capture start runtime resolves ready metadata and forwards audio frames', async () => {
  const proc = createProc();
  const states = [];
  const frames = [];
  const state = {
    disabledReason: null,
    owners: new Set(),
    session: null,
    startPromise: null,
  };

  const runtime = createAppleVoiceCaptureStartRuntime({
    appendAppleVoiceCaptureFrames(sessionState, chunk, { onFirstFrame, onFrame }) {
      sessionState.firstFrameReceived = true;
      onFrame({ bytes: chunk.length });
      onFirstFrame();
    },
    applyAppleVoiceCaptureReadyPayload(sessionState, payload) {
      sessionState.ready = true;
      sessionState.frameBytes = payload.frameBytes;
      sessionState.metadata = { sampleRate: payload.sampleRate };
    },
    buildAppleVoiceCaptureEndedError: () => new Error('ended'),
    clearAppleVoiceCaptureFirstFrameTimeout: () => {},
    createAppleVoiceCaptureSessionState(nextProc) {
      return {
        proc: nextProc,
        ready: false,
        frameBytes: 0,
        firstFrameReceived: false,
        stopping: false,
        metadata: null,
      };
    },
    emitState: (payload) => states.push(payload),
    ensureAppleVoiceHelperBinary: async () => '/tmp/apple-helper',
    firstFrameTimeoutMs: 1200,
    isAppleVoiceCaptureSupported: () => true,
    markAppleVoiceCaptureUnavailable: () => {},
    normalizeAppleVoiceCaptureOwnerId: (value) => value?.trim?.() || 'default',
    readAppleVoiceJsonLine: (line) => JSON.parse(line),
    sendFrame: (frame) => frames.push(frame),
    shouldDisableAppleVoiceCaptureForMessage: () => false,
    spawn() {
      process.nextTick(() => {
        proc.stderr.emit('data', Buffer.from('{"type":"ready","frameBytes":4,"sampleRate":48000}\n'));
        proc.stdout.emit('data', Buffer.from([1, 2, 3, 4]));
      });
      return proc;
    },
    state,
    stopAppleVoiceCaptureSession: () => false,
  });

  const metadata = await runtime.startAppleVoiceCaptureSession(' room-1 ');

  assert.deepEqual(metadata, { sampleRate: 48000 });
  assert.equal(state.owners.has('room-1'), true);
  assert.deepEqual(states, [{
    type: 'ready',
    sampleRate: 48000,
  }]);
  assert.deepEqual(frames, [{ bytes: 4 }]);
});

test('electron apple voice capture start runtime disables the feature on fatal helper errors', async () => {
  const proc = createProc();
  const states = [];
  const state = {
    disabledReason: null,
    owners: new Set(),
    session: null,
    startPromise: null,
  };

  const runtime = createAppleVoiceCaptureStartRuntime({
    appendAppleVoiceCaptureFrames: () => {},
    applyAppleVoiceCaptureReadyPayload: () => {},
    buildAppleVoiceCaptureEndedError: () => new Error('ended'),
    clearAppleVoiceCaptureFirstFrameTimeout: () => {},
    createAppleVoiceCaptureSessionState(nextProc) {
      return {
        proc: nextProc,
        ready: false,
        frameBytes: 0,
        firstFrameReceived: false,
        stopping: false,
        metadata: null,
      };
    },
    emitState: (payload) => states.push(payload),
    ensureAppleVoiceHelperBinary: async () => '/tmp/apple-helper',
    firstFrameTimeoutMs: 1200,
    isAppleVoiceCaptureSupported: () => true,
    markAppleVoiceCaptureUnavailable(message) {
      state.disabledReason = message;
      states.push({ type: 'unavailable', message });
    },
    normalizeAppleVoiceCaptureOwnerId: (value) => value?.trim?.() || 'default',
    readAppleVoiceJsonLine: (line) => JSON.parse(line),
    sendFrame: () => {},
    shouldDisableAppleVoiceCaptureForMessage: (message) => message.includes('VoiceProcessingIO'),
    spawn() {
      process.nextTick(() => {
        proc.stderr.emit('data', Buffer.from('{"type":"fatal","message":"VoiceProcessingIO is unavailable on this device"}\n'));
      });
      return proc;
    },
    state,
    stopAppleVoiceCaptureSession: () => false,
  });

  await assert.rejects(
    runtime.startAppleVoiceCaptureSession('room-2'),
    /VoiceProcessingIO is unavailable on this device/
  );

  assert.equal(state.disabledReason, 'VoiceProcessingIO is unavailable on this device');
  assert.deepEqual(states, [{
    type: 'unavailable',
    message: 'VoiceProcessingIO is unavailable on this device',
  }]);
});
