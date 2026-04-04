import test from 'node:test';
import assert from 'node:assert/strict';

import { startAudioSettingsAppleIsolationTest } from '../../../client/src/features/voice/audioSettingsAppleRuntime.mjs';

test('audio settings apple runtime returns false when the feature is unsupported', async () => {
  const refs = {
    appleVoiceAvailableRef: { current: true },
  };

  const started = await startAudioSettingsAppleIsolationTest({
    refs,
    deps: {
      createApplePcmBridgeNodeFn: async () => null,
      startAppleVoiceCaptureFn: async () => ({}),
      isAppleVoiceCaptureSupportedFn: async () => false,
    },
  });

  assert.equal(started, false);
  assert.equal(refs.appleVoiceAvailableRef.current, false);
});

test('audio settings apple runtime starts the apple mic test and updates diagnostics', async () => {
  const meterLevels = [];
  const testingStates = [];
  const startingStates = [];
  let diagnostics = null;
  let capturedStateHandler = null;

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
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
    testRunIdRef: { current: 4 },
    animFrameRef: { current: null },
    appleVoiceFrameCleanupRef: { current: null },
    appleVoiceStateCleanupRef: { current: null },
    appleVoiceSourceNodeRef: { current: null },
    appleVoiceAvailableRef: { current: true },
    previewAudioRef: { current: null },
    audioCtxRef: { current: null },
    gainRef: { current: null },
  };

  const started = await startAudioSettingsAppleIsolationTest({
    refs,
    deps: {
      activeVoiceMode: 'standard',
      activeOutputId: 'speaker-1',
      monitorProfile: { id: 'balanced', gain: 0.65, label: 'Studio Speakers' },
      requestedOutputDeviceId: 'speaker-1',
      usedDefaultOutputFallback: false,
      noiseSuppressionEnabled: true,
      runId: 4,
      testStart: 10,
      testStartedAt: '2026-03-25T20:00:00.000Z',
      updateMicMeterFn: (level) => meterLevels.push(level),
      setTestDiagnosticsFn: (value) => {
        diagnostics = typeof value === 'function' ? value(diagnostics) : value;
      },
      setTestingFn: (value) => testingStates.push(value),
      setTestStartingFn: (value) => startingStates.push(value),
      attachMonitorOutputFn: async () => ({
        monitorSetupMs: 6,
        playbackState: 'live-playing',
        playbackError: null,
      }),
      createApplePcmBridgeNodeFn: async () => ({
        port: { postMessage() {} },
        connect() {},
        disconnect() {},
      }),
      getFriendlyAppleVoiceFallbackMessageFn: (message) => `fallback:${message}`,
      normalizeElectronBinaryChunkFn: (chunk) => chunk,
      startAppleVoiceCaptureFn: async () => ({
        sampleRate: 48000,
        channels: 1,
        configuration: 'full-duplex',
      }),
      stopAppleVoiceCaptureFn: async () => {},
      isAppleVoiceCaptureSupportedFn: async () => true,
      onAppleVoiceCaptureFrameFn: () => () => {},
      onAppleVoiceCaptureStateFn: (handler) => {
        capturedStateHandler = handler;
        return () => {};
      },
      getVoiceAudioContextOptionsFn: () => undefined,
      performanceNowFn: () => 25,
      roundMsFn: (value) => value,
      withTimeoutFn: async (promise) => promise,
      requestAnimationFrameFn: () => 123,
      audioContextCtor: FakeAudioContext,
      readStoredMicGainFn: () => 2.5,
    },
  });

  assert.equal(started, true);
  assert.deepEqual(testingStates, [true]);
  assert.deepEqual(startingStates, [false]);
  assert.ok(meterLevels[0] > 0);
  assert.equal(diagnostics.filter.backend, 'apple-voice-processing');
  assert.equal(diagnostics.playback.state, 'live-playing');
  assert.equal(diagnostics.sourceTrack.label, 'Apple voice processing');
  assert.equal(refs.audioCtxRef.current instanceof FakeAudioContext, true);
  assert.equal(typeof refs.appleVoiceStateCleanupRef.current, 'function');

  capturedStateHandler?.({ type: 'error', message: 'helper-ended' });
  assert.equal(diagnostics.filter.backend, 'raw');
  assert.equal(diagnostics.filter.fallbackReason, 'fallback:helper-ended');
  assert.equal(diagnostics.playback.state, 'interrupted');
});

test('audio settings apple runtime accepts the capture-only helper configuration', async () => {
  let diagnostics = null;

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
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
    testRunIdRef: { current: 1 },
    animFrameRef: { current: null },
    appleVoiceFrameCleanupRef: { current: null },
    appleVoiceStateCleanupRef: { current: null },
    appleVoiceSourceNodeRef: { current: null },
    appleVoiceAvailableRef: { current: true },
    previewAudioRef: { current: null },
    audioCtxRef: { current: null },
    gainRef: { current: null },
  };

  const started = await startAudioSettingsAppleIsolationTest({
    refs,
    deps: {
      activeVoiceMode: 'standard',
      activeOutputId: 'default',
      monitorProfile: { id: 'speaker-safe', gain: 0.8, label: 'Built-in Speakers' },
      requestedOutputDeviceId: 'default',
      usedDefaultOutputFallback: false,
      noiseSuppressionEnabled: true,
      runId: 1,
      testStart: 10,
      testStartedAt: '2026-04-02T00:00:00.000Z',
      updateMicMeterFn: () => {},
      setTestDiagnosticsFn: (value) => {
        diagnostics = typeof value === 'function' ? value(diagnostics) : value;
      },
      setTestingFn: () => {},
      setTestStartingFn: () => {},
      attachMonitorOutputFn: async () => ({
        monitorSetupMs: 6,
        playbackState: 'live-playing',
        playbackError: null,
      }),
      createApplePcmBridgeNodeFn: async () => ({
        port: { postMessage() {} },
        connect() {},
        disconnect() {},
      }),
      getFriendlyAppleVoiceFallbackMessageFn: (message) => message,
      normalizeElectronBinaryChunkFn: (chunk) => chunk,
      startAppleVoiceCaptureFn: async () => ({
        sampleRate: 48000,
        channels: 1,
        configuration: 'capture-only',
      }),
      stopAppleVoiceCaptureFn: async () => {},
      isAppleVoiceCaptureSupportedFn: async () => true,
      onAppleVoiceCaptureFrameFn: () => () => {},
      onAppleVoiceCaptureStateFn: () => () => {},
      getVoiceAudioContextOptionsFn: () => undefined,
      performanceNowFn: () => 25,
      roundMsFn: (value) => value,
      withTimeoutFn: async (promise) => promise,
      requestAnimationFrameFn: () => 123,
      audioContextCtor: FakeAudioContext,
      readStoredMicGainFn: () => 2.5,
    },
  });

  assert.equal(started, true);
  assert.equal(diagnostics.filter.backend, 'apple-voice-processing');
});
