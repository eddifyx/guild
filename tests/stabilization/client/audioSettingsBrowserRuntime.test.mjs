import test from 'node:test';
import assert from 'node:assert/strict';

import { startAudioSettingsBrowserMicTest } from '../../../client/src/features/voice/audioSettingsBrowserRuntime.mjs';

test('audio settings browser runtime falls back to the default mic and starts monitoring', async () => {
  const testingStates = [];
  const startingStates = [];
  const meterLevels = [];
  const perfPhases = [];
  const requestedConstraints = [];
  let diagnostics = null;

  const track = {
    kind: 'audio',
    readyState: 'live',
    getSettings() {
      return { deviceId: 'default-mic' };
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
        gain: { value: 0 },
        connect() {},
      };
    }
    createAnalyser() {
      return {
        fftSize: 0,
        frequencyBinCount: 4,
        getByteFrequencyData(data) {
          data.fill(64);
        },
      };
    }
    async close() {}
  }

  const refs = {
    testRunIdRef: { current: 2 },
    streamRef: { current: null },
    audioCtxRef: { current: null },
    gainRef: { current: null },
    noiseSuppressionRoutingRef: { current: null },
    animFrameRef: { current: null },
    processingModeRef: { current: 'ultra-low-latency' },
    noiseSuppressionRef: { current: false },
    noiseSuppressorNodeRef: { current: null },
    residualDenoiserNodeRef: { current: null },
    noiseGateNodeRef: { current: null },
    speechFocusChainRef: { current: null },
    keyboardSuppressorNodeRef: { current: null },
  };

  let getUserMediaCalls = 0;
  const result = await startAudioSettingsBrowserMicTest({
    refs,
    deps: {
      activeVoiceMode: 'ultra-low-latency',
      activeInputId: 'saved-device',
      activeOutputId: 'speaker-1',
      monitorProfile: { id: 'balanced', gain: 0.65, label: 'Speakers' },
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
      initialConstraints: {
        audio: { deviceId: { exact: 'saved-device' } },
      },
      fallbackConstraints: {
        audio: { deviceId: undefined },
      },
      runId: 2,
      testStart: 10,
      testStartedAt: '2026-03-25T20:15:00.000Z',
      attachMonitorOutputFn: async () => ({
        monitorSetupMs: 8,
        playbackState: 'live-playing',
        playbackError: null,
      }),
      updateMicMeterFn: (level) => meterLevels.push(level),
      applyNoiseSuppressionRoutingFn: () => false,
      setTestingFn: (value) => testingStates.push(value),
      setTestStartingFn: (value) => startingStates.push(value),
      setTestDiagnosticsFn: (value) => {
        diagnostics = typeof value === 'function' ? value(diagnostics) : value;
      },
      addPerfPhaseFn: (traceId, phase, details) => {
        perfPhases.push([traceId, phase, details]);
      },
      perfTraceId: 'mic-trace',
      getUserMediaFn: async (constraints) => {
        requestedConstraints.push(constraints);
        getUserMediaCalls += 1;
        if (getUserMediaCalls === 1) {
          throw new Error('Saved mic missing');
        }
        return stream;
      },
      audioContextCtor: FakeAudioContext,
      getVoiceAudioContextOptionsFn: () => undefined,
      summarizeTrackSnapshotFn: () => ({ label: 'fallback-mic' }),
      summarizeAudioContextFn: () => ({ sampleRate: 48000 }),
      resolveNoiseSuppressionRuntimeStateFn: () => ({
        backend: 'raw',
        requiresWarmup: false,
        fallbackReason: null,
      }),
      requestAnimationFrameFn: () => 88,
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
    },
  });

  assert.equal(result.usedDefaultDeviceFallback, true);
  assert.equal(result.playbackState, 'live-playing');
  assert.equal(result.suppressionRuntime.backend, 'raw');
  assert.equal(refs.streamRef.current, stream);
  assert.equal(refs.audioCtxRef.current instanceof FakeAudioContext, true);
  assert.deepEqual(testingStates, [true]);
  assert.deepEqual(startingStates, [false]);
  assert.ok(meterLevels[0] > 0);
  assert.equal(diagnostics.usedDefaultDeviceFallback, true);
  assert.deepEqual(diagnostics.requestedConstraints, { deviceId: undefined });
  assert.equal(diagnostics.playback.state, 'live-playing');
  assert.equal(requestedConstraints.length, 2);
  assert.equal(perfPhases.some(([, phase, details]) => phase === 'get-user-media-ready' && details.usedDefaultDeviceFallback === true), true);
  assert.equal(perfPhases.some(([, phase]) => phase === 'monitor-ready'), true);
});
