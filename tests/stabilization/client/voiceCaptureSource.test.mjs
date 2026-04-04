import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acquireVoiceCaptureStream,
  canReuseVoiceCaptureStream,
} from '../../../client/src/features/voice/voiceCaptureSource.mjs';

test('voice capture source detects when an existing stream can be reused', () => {
  const previousCapture = {
    stream: {
      getAudioTracks() {
        return [{ readyState: 'live' }];
      },
    },
    requestedInputId: 'mic-1',
    usedDefaultDeviceFallback: false,
  };

  assert.equal(canReuseVoiceCaptureStream(previousCapture, {
    requestedInputId: 'mic-1',
    forceFreshRawMicCapture: false,
  }), true);
  assert.equal(canReuseVoiceCaptureStream(previousCapture, {
    requestedInputId: 'mic-2',
    forceFreshRawMicCapture: false,
  }), false);
});

test('voice capture source reuses a prior track when constraints can be reapplied', async () => {
  const applyCalls = [];
  const previousCapture = {
    stream: {
      getAudioTracks() {
        return [{
          readyState: 'live',
          applyConstraints: async (constraints) => {
            applyCalls.push(constraints);
          },
        }];
      },
    },
    requestedInputId: 'mic-1',
    usedDefaultDeviceFallback: false,
  };

  const result = await acquireVoiceCaptureStream({
    previousCapture,
    requestedInputId: 'mic-1',
    captureConstraintMode: 'balanced',
    noiseSuppressionEnabled: true,
    initialConstraints: { audio: { deviceId: 'mic-1' } },
    fallbackConstraints: { audio: true },
    buildTrackConstraintPatchFn: ({ mode, noiseSuppressionEnabled }) => ({ mode, noiseSuppressionEnabled }),
  });

  assert.equal(result.stream, previousCapture.stream);
  assert.equal(result.reusedExistingStream, true);
  assert.equal(result.getUserMediaMs, 0);
  assert.deepEqual(applyCalls, [{ mode: 'balanced', noiseSuppressionEnabled: true }]);
});

test('voice capture source falls back to the default device after a saved-device failure', async () => {
  const getUserMediaCalls = [];
  const mediaDevices = {
    async getUserMedia(constraints) {
      getUserMediaCalls.push(constraints);
      if (getUserMediaCalls.length === 1) {
        throw new Error('saved device missing');
      }
      return { id: 'stream-default' };
    },
  };

  const result = await acquireVoiceCaptureStream({
    requestedInputId: 'mic-1',
    captureConstraintMode: 'balanced',
    noiseSuppressionEnabled: true,
    initialConstraints: { audio: { deviceId: 'mic-1' } },
    fallbackConstraints: { audio: true },
    buildTrackConstraintPatchFn: () => ({}),
    mediaDevices,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.deepEqual(getUserMediaCalls, [
    { audio: { deviceId: 'mic-1' } },
    { audio: true },
  ]);
  assert.equal(result.stream.id, 'stream-default');
  assert.equal(result.usedDefaultDeviceFallback, true);
  assert.deepEqual(result.appliedConstraints, { audio: true });
  assert.equal(result.error, null);
});

test('voice capture source returns the fallback failure when both acquisitions fail', async () => {
  const reuseErrors = [];
  const savedDeviceErrors = [];
  const previousCapture = {
    stream: {
      getAudioTracks() {
        return [{
          readyState: 'live',
          applyConstraints: async () => {
            throw new Error('reuse failed');
          },
        }];
      },
    },
    requestedInputId: 'mic-1',
    usedDefaultDeviceFallback: false,
  };
  const mediaDevices = {
    async getUserMedia() {
      throw new Error('fallback failed');
    },
  };

  const result = await acquireVoiceCaptureStream({
    previousCapture,
    requestedInputId: 'mic-1',
    captureConstraintMode: 'balanced',
    noiseSuppressionEnabled: true,
    initialConstraints: { audio: { deviceId: 'mic-1' } },
    fallbackConstraints: { audio: true },
    buildTrackConstraintPatchFn: () => ({}),
    mediaDevices,
    onReuseFailed: (error) => reuseErrors.push(error.message),
    onSavedDeviceFailed: (error) => savedDeviceErrors.push(error.message),
  });

  assert.equal(result.stream, null);
  assert.equal(result.error.message, 'fallback failed');
  assert.deepEqual(reuseErrors, ['reuse failed']);
  assert.deepEqual(savedDeviceErrors, ['fallback failed']);
});
