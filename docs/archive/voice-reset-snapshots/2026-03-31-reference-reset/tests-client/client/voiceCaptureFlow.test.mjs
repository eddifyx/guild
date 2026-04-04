import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceLiveMicCapture } from '../../../client/src/features/voice/voiceCaptureFlow.mjs';

function installNavigatorMediaDevices(mediaDevices) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { mediaDevices },
  });
}

test('voice capture flow returns an error payload when microphone acquisition fails', async () => {
  installNavigatorMediaDevices({
    async getUserMedia() {
      throw new Error('Mic denied');
    },
  });

  const result = await createVoiceLiveMicCapture({
    chId: 'channel-1',
    mode: 'studio',
    refs: {
      liveCaptureRef: { current: null },
      appleVoiceAvailableRef: { current: false },
    },
    deps: {
      voiceSafeMode: false,
      forceFreshRawMicCapture: true,
      audioContextCtor: class FakeAudioContext {},
      performanceNowFn: () => 10,
      nowIsoFn: () => '2026-03-25T21:00:00.000Z',
      roundMsFn: (value) => value,
      warnFn: () => {},
    },
  });

  assert.equal(result.capture, null);
  assert.equal(result.error.message, 'Mic denied');
  assert.equal(result.diagnostics.channelId, 'channel-1');
  assert.equal(result.diagnostics.error, 'Mic denied');
});

test('voice capture flow builds a safe-mode capture when voice safe mode is enabled', async () => {
  const track = {
    id: 'audio-track-1',
    kind: 'audio',
    readyState: 'live',
    getSettings() {
      return {};
    },
  };
  installNavigatorMediaDevices({
    async getUserMedia() {
      return {
        getAudioTracks() {
          return [track];
        },
      };
    },
  });

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
    }
    createMediaStreamSource() {
      return {
        connect() {},
      };
    }
    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
      };
    }
    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks() {
            return [{ id: 'processed-track-1' }];
          },
        },
      };
    }
  }

  const result = await createVoiceLiveMicCapture({
    chId: 'channel-2',
    mode: 'ultra-low-latency',
    refs: {
      liveCaptureRef: { current: null },
      appleVoiceAvailableRef: { current: false },
    },
    deps: {
      voiceSafeMode: true,
      forceFreshRawMicCapture: true,
      audioContextCtor: FakeAudioContext,
      performanceNowFn: () => 25,
      nowIsoFn: () => '2026-03-25T21:15:00.000Z',
      roundMsFn: (value) => value,
      summarizeTrackSnapshotFn: (value) => value?.id || null,
      warnFn: () => {},
    },
  });

  assert.ok(result.capture);
  assert.equal(result.noiseSuppressionEnabled, false);
  assert.equal(result.diagnostics.channelId, 'channel-2');
  assert.equal(result.diagnostics.filter.backend, 'raw');
  assert.equal(result.diagnostics.filter.fallbackReason, 'Voice safe mode active');
  assert.equal(result.diagnostics.producedTrack, 'audio-track-1');
});

test('voice capture flow keeps the live producer on the real mic track in the direct raw lane', async () => {
  const sourceTrack = {
    id: 'audio-track-direct',
    kind: 'audio',
    enabled: false,
    readyState: 'live',
    getSettings() {
      return {
        sampleRate: 48000,
      };
    },
    getConstraints() {
      return {};
    },
  };

  installNavigatorMediaDevices({
    async getUserMedia() {
      return {
        getAudioTracks() {
          return [sourceTrack];
        },
      };
    },
  });

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
      this.baseLatency = 0.0053;
      this.outputLatency = 0;
    }
    createMediaStreamSource() {
      return {
        connect() {},
      };
    }
    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
      };
    }
    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks() {
            return [{ id: 'processed-track-direct', enabled: false }];
          },
        },
      };
    }
  }

  const result = await createVoiceLiveMicCapture({
    chId: 'channel-direct',
    mode: 'ultra-low-latency',
    refs: {
      liveCaptureRef: { current: null },
      appleVoiceAvailableRef: { current: false },
    },
    deps: {
      voiceSafeMode: false,
      forceFreshRawMicCapture: true,
      audioContextCtor: FakeAudioContext,
      performanceNowFn: () => 100,
      nowIsoFn: () => '2026-03-31T18:00:00.000Z',
      roundMsFn: (value) => value,
      summarizeTrackSnapshotFn: (value) => value?.id || null,
      warnFn: () => {},
    },
  });

  assert.ok(result.capture);
  assert.equal(result.capture.outputTrack.id, 'processed-track-direct');
  assert.equal(result.capture.outputTrackMode, 'processed-destination');
  assert.equal(result.diagnostics.producedTrack, 'processed-track-direct');
  assert.equal(result.diagnostics.outputTrackMode, 'processed-destination');
});

test('voice capture flow keeps the live producer on the real mic track when backend startup falls back to raw', async () => {
  const sourceTrack = {
    id: 'audio-track-raw-fallback',
    kind: 'audio',
    enabled: false,
    readyState: 'live',
    getSettings() {
      return {
        sampleRate: 48000,
      };
    },
    getConstraints() {
      return {};
    },
  };

  installNavigatorMediaDevices({
    async getUserMedia() {
      return {
        getAudioTracks() {
          return [sourceTrack];
        },
      };
    },
  });

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
      this.baseLatency = 0.0053;
      this.outputLatency = 0;
    }
    createMediaStreamSource() {
      return {
        connect() {},
      };
    }
    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
      };
    }
    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks() {
            return [{ id: 'processed-track-raw-fallback', enabled: false }];
          },
        },
      };
    }
  }

  const result = await createVoiceLiveMicCapture({
    chId: 'channel-raw-fallback',
    mode: 'noise-suppression',
    refs: {
      liveCaptureRef: { current: null },
      appleVoiceAvailableRef: { current: false },
    },
    deps: {
      voiceSafeMode: false,
      voiceEmergencyDirectSourceTrack: false,
      forceFreshRawMicCapture: true,
      audioContextCtor: FakeAudioContext,
      startVoiceCaptureProcessingBackendFn: async () => ({
        backendMode: 'raw',
        suppressionRuntime: {
          backend: 'raw',
          requiresWarmup: false,
          fallbackReason: 'RNNoise fallback',
        },
        workletCreateMs: 0,
      }),
      performanceNowFn: () => 100,
      nowIsoFn: () => '2026-03-31T18:05:00.000Z',
      roundMsFn: (value) => value,
      summarizeTrackSnapshotFn: (value) => value?.id || null,
      warnFn: () => {},
    },
  });

  assert.ok(result.capture);
  assert.equal(result.capture.outputTrack.id, 'processed-track-raw-fallback');
  assert.equal(result.capture.outputTrackMode, 'processed-destination');
  assert.equal(result.diagnostics.producedTrack, 'processed-track-raw-fallback');
  assert.equal(result.diagnostics.outputTrackMode, 'processed-destination');
});
