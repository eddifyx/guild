import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createAppleVoiceCaptureSupportRuntime,
} = require('../../../client/electron/appleVoiceCaptureSupportRuntime.js');

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

test('electron apple voice capture support runtime marks support and prime state canonically', async () => {
  const state = {
    disabledReason: null,
    owners: new Set(),
    session: null,
    startPromise: null,
  };
  const sentStates = [];
  const runtime = createAppleVoiceCaptureSupportRuntime({
    ensureAppleVoiceHelperBinary: async () => '/tmp/apple-helper',
    isAppleVoiceCapturePlatformSupported: () => true,
    normalizeAppleVoiceCaptureOwnerId: (value) => value?.trim?.() || 'default',
    prepareAppleVoiceCaptureSessionForStop: () => {},
    sendState: (payload) => sentStates.push(payload),
    state,
  });

  assert.equal(runtime.isAppleVoiceCaptureSupported(), true);
  assert.deepEqual(await runtime.primeAppleVoiceCapture(), {
    supported: true,
    binaryPath: '/tmp/apple-helper',
    disabledReason: null,
  });

  runtime.markAppleVoiceCaptureUnavailable('VoiceProcessingIO is unavailable on this device');
  assert.equal(runtime.isAppleVoiceCaptureSupported(), false);
  assert.deepEqual(await runtime.primeAppleVoiceCapture(), {
    supported: false,
    binaryPath: '/tmp/apple-helper',
    disabledReason: 'VoiceProcessingIO is unavailable on this device',
  });
  assert.deepEqual(sentStates, [{
    type: 'unavailable',
    message: 'VoiceProcessingIO is unavailable on this device',
  }]);
});

test('electron apple voice capture support runtime stops only when the last owner leaves', () => {
  const proc = createProc();
  let prepared = null;
  const state = {
    disabledReason: null,
    owners: new Set(['room-1', 'room-2']),
    session: { proc },
    startPromise: Promise.resolve('ready'),
  };
  const runtime = createAppleVoiceCaptureSupportRuntime({
    ensureAppleVoiceHelperBinary: async () => '/tmp/apple-helper',
    isAppleVoiceCapturePlatformSupported: () => true,
    normalizeAppleVoiceCaptureOwnerId: (value) => value?.trim?.() || 'default',
    prepareAppleVoiceCaptureSessionForStop: (sessionState) => {
      prepared = sessionState;
    },
    sendState: () => {},
    state,
  });

  assert.equal(runtime.stopAppleVoiceCaptureSession('room-1'), false);
  assert.equal(state.session, prepared === null ? state.session : null);
  assert.equal(state.owners.has('room-2'), true);

  assert.equal(runtime.stopAppleVoiceCaptureSession('room-2'), true);
  assert.equal(prepared.proc, proc);
  assert.equal(state.session, null);
  assert.equal(state.startPromise, null);
  assert.deepEqual(proc.killCalls, ['SIGTERM']);
});
