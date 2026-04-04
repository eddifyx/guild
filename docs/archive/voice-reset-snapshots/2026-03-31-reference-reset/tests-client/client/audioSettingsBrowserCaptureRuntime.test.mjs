import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acquireAudioSettingsBrowserMicStream,
  setupAudioSettingsBrowserMicGraph,
} from '../../../client/src/features/voice/audioSettingsBrowserCaptureRuntime.mjs';

test('audio settings browser capture runtime falls back to default input and records perf metadata', async () => {
  const perfPhases = [];
  const requestedConstraints = [];
  let calls = 0;

  const stream = {
    getAudioTracks() {
      return [{ kind: 'audio', readyState: 'live' }];
    },
  };

  const result = await acquireAudioSettingsBrowserMicStream({
    activeInputId: 'saved-device',
    initialConstraints: { audio: { deviceId: { exact: 'saved-device' } } },
    fallbackConstraints: { audio: { deviceId: undefined } },
    getUserMediaFn: async (constraints) => {
      requestedConstraints.push(constraints);
      calls += 1;
      if (calls === 1) throw new Error('missing');
      return stream;
    },
    performanceNowFn: (() => {
      let now = 0;
      return () => {
        now += 5;
        return now;
      };
    })(),
    roundMsFn: (value) => value,
    addPerfPhaseFn: (traceId, phase, details) => perfPhases.push([traceId, phase, details]),
    perfTraceId: 'trace',
  });

  assert.equal(result.stream, stream);
  assert.equal(result.usedDefaultDeviceFallback, true);
  assert.deepEqual(result.appliedConstraints, { audio: { deviceId: undefined } });
  assert.equal(requestedConstraints.length, 2);
  assert.equal(perfPhases.some(([, phase, details]) => phase === 'get-user-media-ready' && details.usedDefaultDeviceFallback === true), true);
});

test('audio settings browser capture runtime builds the raw audio graph and monitor state', async () => {
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
    }
    createMediaStreamSource(stream) {
      return {
        stream,
        connect() {},
      };
    }
    createGain() {
      return {
        gain: { value: 0 },
        connect() {},
      };
    }
    createAnalyser() {
      return {
        fftSize: 0,
        frequencyBinCount: 4,
        getByteFrequencyData() {},
      };
    }
    async close() {}
  }

  const track = {
    kind: 'audio',
    readyState: 'live',
    getSettings() {
      return { deviceId: 'mic-1' };
    },
  };
  const stream = {
    getAudioTracks() {
      return [track];
    },
    getTracks() {
      return [track];
    },
  };

  const refs = {
    testRunIdRef: { current: 3 },
    audioCtxRef: { current: null },
    gainRef: { current: null },
    noiseSuppressionRoutingRef: { current: null },
  };

  const result = await setupAudioSettingsBrowserMicGraph({
    refs,
    deps: {
      stream,
      runId: 3,
      activeVoiceMode: 'ultra-low-latency',
      activeOutputId: 'speaker-1',
      monitorProfile: { id: 'balanced', gain: 0.75, label: 'Speakers' },
      outputSelection: {
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      },
      requestedOutputDeviceId: 'speaker-1',
      noiseSuppressionEnabled: false,
      useRawMicPath: true,
      requestedSuppressionRuntime: {
        backend: 'raw',
        requiresWarmup: false,
      },
      attachMonitorOutputFn: async () => ({
        monitorSetupMs: 7,
        playbackState: 'live-playing',
        playbackError: null,
      }),
      addPerfPhaseFn: () => {},
      audioContextCtor: FakeAudioContext,
      getVoiceAudioContextOptionsFn: () => undefined,
      summarizeTrackSnapshotFn: () => ({ label: 'mic-1' }),
      summarizeAudioContextFn: () => ({ sampleRate: 48000 }),
      resolveNoiseSuppressionRuntimeStateFn: () => ({
        backend: 'raw',
        requiresWarmup: false,
        fallbackReason: null,
      }),
      performanceNowFn: (() => {
        let now = 10;
        return () => {
          now += 5;
          return now;
        };
      })(),
      roundMsFn: (value) => value,
      readStoredMicGainFn: () => 1.5,
      voiceNoiseSuppressionBackends: {
        WEBRTC_APM: 'webrtc-apm',
        RNNOISE: 'rnnoise',
      },
      rnnoiseMonitorMakeupGain: 2.4,
    },
  });

  assert.equal(result.suppressionRuntime.backend, 'raw');
  assert.equal(result.monitorPlaybackState, 'live-playing');
  assert.equal(result.outputDeviceId, 'speaker-1');
  assert.equal(result.outputDeviceLabel, 'Speakers');
  assert.equal(result.monitorProfileId, 'balanced');
  assert.equal(result.monitorGain, 0.75);
  assert.equal(result.usedDefaultOutputFallback, false);
  assert.deepEqual(result.sourceTrackSummary, { label: 'mic-1' });
  assert.deepEqual(result.audioContextSummary, { sampleRate: 48000 });
  assert.equal(refs.audioCtxRef.current instanceof FakeAudioContext, true);
  assert.equal(typeof refs.gainRef.current.connect, 'function');
});
