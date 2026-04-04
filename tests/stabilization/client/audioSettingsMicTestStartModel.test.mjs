import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsMicTestInitialDiagnostics,
  buildAudioSettingsMicTestStartState,
} from '../../../client/src/features/voice/audioSettingsMicTestStartModel.mjs';

test('audio settings mic test start model keeps darwin default-input noise suppression on the browser/WebRTC lane', () => {
  const state = buildAudioSettingsMicTestStartState({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: '' },
      selectedOutputRef: { current: 'speaker-1' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: true },
    },
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    deps: {
      referenceVoiceLane: false,
      getPlatformFn: () => 'darwin',
      voiceProcessingModes: { STANDARD: 'standard' },
      voiceNoiseSuppressionBackends: { WEBRTC_APM: 'webrtc-apm' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: 'speaker-1',
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({
        id: 'studio',
        label: 'Studio Speakers',
        gain: 0.55,
      }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      getNoiseSuppressionRuntimeStateFn: ({ preferAppleVoiceProcessing, noiseSuppressionBackend }) => ({
        backend: preferAppleVoiceProcessing ? 'apple-voice-processing' : (noiseSuppressionBackend || 'rnnoise'),
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: ({ deviceId }) => ({
        audio: deviceId ? { deviceId } : { echoCancellation: false },
      }),
    },
  });

  assert.equal(state.activeVoiceMode, 'standard');
  assert.equal(state.activeInputId, '');
  assert.equal(state.activeOutputId, 'speaker-1');
  assert.equal(state.noiseSuppressionEnabled, true);
  assert.equal(state.useRawMicPath, false);
  assert.equal(state.allowAppleVoiceMonitorTest, false);
  assert.equal(state.preferSystemMicMode, true);
  assert.equal(state.shouldUseAppleVoiceProcessing, false);
  assert.equal(state.requestedSuppressionRuntime.backend, 'webrtc-apm');
  assert.deepEqual(state.initialConstraints, { audio: { echoCancellation: false } });
  assert.deepEqual(state.fallbackConstraints, { audio: { echoCancellation: false } });
});

test('audio settings mic test start model avoids the helper path off darwin as well', () => {
  const state = buildAudioSettingsMicTestStartState({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: '' },
      selectedOutputRef: { current: 'speaker-1' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: true },
    },
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    deps: {
      referenceVoiceLane: false,
      getPlatformFn: () => 'win32',
      voiceProcessingModes: { STANDARD: 'standard' },
      voiceNoiseSuppressionBackends: { WEBRTC_APM: 'webrtc-apm' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: 'speaker-1',
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({
        id: 'studio',
        label: 'Studio Speakers',
        gain: 0.55,
      }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      getNoiseSuppressionRuntimeStateFn: ({ preferAppleVoiceProcessing, noiseSuppressionBackend }) => ({
        backend: preferAppleVoiceProcessing ? 'apple-voice-processing' : (noiseSuppressionBackend || 'rnnoise'),
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: ({ deviceId }) => ({
        audio: deviceId ? { deviceId } : { echoCancellation: false },
      }),
    },
  });

  assert.equal(state.allowAppleVoiceMonitorTest, false);
  assert.equal(state.preferSystemMicMode, false);
  assert.equal(state.shouldUseAppleVoiceProcessing, false);
  assert.equal(state.requestedSuppressionRuntime.backend, 'rnnoise');
});

test('audio settings mic test start model normalizes a stored default input id back to the implicit default device', () => {
  const state = buildAudioSettingsMicTestStartState({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: 'default' },
      selectedOutputRef: { current: 'speaker-1' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: true },
    },
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    deps: {
      referenceVoiceLane: false,
      getPlatformFn: () => 'darwin',
      voiceProcessingModes: { STANDARD: 'standard' },
      voiceNoiseSuppressionBackends: { WEBRTC_APM: 'webrtc-apm' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: 'speaker-1',
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({
        id: 'studio',
        label: 'Studio Speakers',
        gain: 0.55,
      }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      getNoiseSuppressionRuntimeStateFn: ({ noiseSuppressionBackend }) => ({
        backend: noiseSuppressionBackend || 'rnnoise',
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: ({ deviceId }) => ({
        audio: deviceId ? { deviceId } : { echoCancellation: false },
      }),
    },
  });

  assert.equal(state.activeInputId, '');
  assert.equal(state.preferSystemMicMode, true);
  assert.deepEqual(state.initialConstraints, { audio: { echoCancellation: false } });
});

test('audio settings mic test start model builds initial diagnostics payload', () => {
  const diagnostics = buildAudioSettingsMicTestInitialDiagnostics({
    testStartedAt: '2026-03-26T12:00:00.000Z',
    activeVoiceMode: 'standard',
    initialConstraints: { audio: { deviceId: 'default' } },
    activeOutputId: 'speaker-1',
    monitorProfile: {
      id: 'studio',
      label: 'Studio Speakers',
      gain: 0.55,
    },
    selectedOutputDeviceId: 'speaker-1',
    outputSelection: {
      usedDefaultFallback: false,
    },
    shouldUseAppleVoiceProcessing: true,
    requestedSuppressionRuntime: {
      backend: 'rnnoise',
      requiresWarmup: true,
    },
    noiseSuppressionEnabled: true,
    voiceNoiseSuppressionBackends: {
      APPLE: 'apple-voice-processing',
    },
  });

  assert.equal(diagnostics.updatedAt, '2026-03-26T12:00:00.000Z');
  assert.equal(diagnostics.filter.backend, 'apple-voice-processing');
  assert.equal(diagnostics.filter.requestedBackend, 'rnnoise');
  assert.equal(diagnostics.filter.requiresWarmup, true);
  assert.equal(diagnostics.playback.outputDeviceId, 'speaker-1');
  assert.equal(diagnostics.playback.outputDeviceLabel, 'Studio Speakers');
  assert.equal(diagnostics.playback.monitorProfile, 'studio');
  assert.equal(diagnostics.playback.monitorGain, 0.55);
});

test('audio settings mic test start model forces the raw reference lane while the voice reset is active', () => {
  const state = buildAudioSettingsMicTestStartState({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: '' },
      selectedOutputRef: { current: 'speaker-1' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: true },
    },
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    deps: {
      referenceVoiceLane: true,
      getPlatformFn: () => 'darwin',
      voiceProcessingModes: { STANDARD: 'standard', ULTRA_LOW_LATENCY: 'ultra' },
      voiceNoiseSuppressionBackends: { WEBRTC_APM: 'webrtc-apm' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: 'speaker-1',
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({
        id: 'studio',
        label: 'Studio Speakers',
        gain: 0.55,
      }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      getNoiseSuppressionRuntimeStateFn: () => ({
        backend: 'rnnoise',
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: ({ mode, noiseSuppressionEnabled, plain }) => ({
        audio: plain ? true : { mode, noiseSuppressionEnabled },
      }),
    },
  });

  assert.equal(state.referenceVoiceLane, true);
  assert.equal(state.captureConstraintMode, 'ultra');
  assert.equal(state.useRawMicPath, true);
  assert.equal(state.noiseSuppressionEnabled, false);
  assert.equal(state.preferSystemMicMode, false);
  assert.deepEqual(state.requestedSuppressionRuntime, {
    backend: 'raw',
    requiresWarmup: false,
    fallbackReason: 'Reference voice lane active',
  });
  assert.deepEqual(state.initialConstraints, {
    audio: true,
  });
  assert.deepEqual(state.fallbackConstraints, {
    audio: true,
  });
});
