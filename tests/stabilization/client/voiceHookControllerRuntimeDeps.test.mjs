import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceHookCaptureRuntimeDeps,
  buildUseVoiceHookMediaTransportRuntimeDeps,
  buildUseVoiceHookRuntimeBindingsRuntimeDeps,
  buildUseVoiceHookSecurityRuntimeDeps,
  buildUseVoiceHookSessionRuntimeDeps,
  buildUseVoiceHookUiRuntimeDeps,
} from '../../../client/src/features/voice/voiceHookControllerRuntimeDeps.mjs';

test('voice hook controller runtime deps preserve security, capture, and media transport bags', () => {
  const clearVoiceKeyFn = () => {};
  const updateVoiceDiagnosticsFn = () => {};
  assert.deepEqual(buildUseVoiceHookSecurityRuntimeDeps({
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  }), {
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  });

  const applyNoiseSuppressionRoutingFn = () => {};
  const applySenderPreferencesFn = () => {};
  const getVoiceAudioBypassModeFn = () => {};
  assert.deepEqual(buildUseVoiceHookCaptureRuntimeDeps({
    applyNoiseSuppressionRoutingFn,
    updateVoiceDiagnosticsFn,
    applySenderPreferencesFn,
    getVoiceAudioBypassModeFn,
  }), {
    applyNoiseSuppressionRoutingFn,
    updateVoiceDiagnosticsFn,
    applySenderPreferencesFn,
    getVoiceAudioBypassModeFn,
  });

  const emitAsyncFn = () => {};
  const recordLaneDiagnosticFn = () => {};
  const resetScreenShareAdaptationFn = () => {};
  const playStreamStopChimeFn = () => {};
  const getPrimaryCodecMimeTypeFromRtpParametersFn = () => {};
  const getExperimentalScreenVideoBypassModeFn = () => {};
  const summarizeReceiverVideoCodecSupportFn = () => {};
  assert.deepEqual(buildUseVoiceHookMediaTransportRuntimeDeps({
    emitAsyncFn,
    recordLaneDiagnosticFn,
    updateVoiceDiagnosticsFn,
    resetScreenShareAdaptationFn,
    playStreamStopChimeFn,
    getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn,
    summarizeReceiverVideoCodecSupportFn,
  }), {
    emitAsyncFn,
    recordLaneDiagnosticFn,
    updateVoiceDiagnosticsFn,
    resetScreenShareAdaptationFn,
    playStreamStopChimeFn,
    getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn,
    summarizeReceiverVideoCodecSupportFn,
  });
});

test('voice hook controller runtime deps preserve the session runtime bag', () => {
  const emitAsyncFn = () => {};
  const constants = { voiceSessionErrorTimeoutMs: 8000 };
  const deps = ['join', 'capture'];
  const sessionDeps = buildUseVoiceHookSessionRuntimeDeps({
    emitAsyncFn,
    clearVoiceHealthProbeFn: () => {},
    stopAppleVoiceCaptureFn: () => {},
    resetScreenShareAdaptationFn: () => {},
    clearVoiceKeyFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    setVoiceChannelIdFn: () => {},
    setVoiceChannelParticipantsFn: () => {},
    advanceJoinGenerationFn: () => {},
    setTimeoutFn: () => {},
    playLeaveChimeFn: () => {},
    clearTimeoutFn: () => {},
    cancelPerfTraceFn: () => {},
    setJoinErrorFn: () => {},
    setE2EWarningFn: () => {},
    setLiveVoiceFallbackReasonFn: () => {},
    recordLaneDiagnosticFn: () => {},
    ensureSecureMediaReadyFn: () => {},
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => {},
    buildVoiceTrustErrorFn: () => {},
    deviceCtor: class Device {},
    setDeviceFn: () => {},
    createSendTransportFn: () => {},
    createRecvTransportFn: () => {},
    setChannelIdFn: () => {},
    setDeafenedFn: () => {},
    syncVoiceParticipantsFn: () => {},
    getVoiceParticipantIdsFn: () => {},
    consumeProducerFn: () => {},
    syncVoiceE2EStateFn: () => {},
    playConnectChimeFn: () => {},
    getPlatformFn: () => 'darwin',
    prefetchDesktopSourcesFn: () => {},
    applyLiveCaptureToProducerFn: () => {},
    setMutedFn: () => {},
    scheduleVoiceHealthProbeFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => false,
    normalizeVoiceErrorMessageFn: () => 'voice error',
    scheduleClearJoinErrorFn: () => {},
    logErrorFn: () => {},
    constants,
    deps,
  });

  assert.equal(sessionDeps.emitAsyncFn, emitAsyncFn);
  assert.equal(sessionDeps.constants, constants);
  assert.equal(sessionDeps.deps, deps);
  assert.equal(typeof sessionDeps.consumeProducerFn, 'function');
});

test('voice hook controller runtime deps preserve the ui runtime bag', () => {
  const deps = ['ui'];
  const uiDeps = buildUseVoiceHookUiRuntimeDeps({
    clearVoiceHealthProbeFn: () => {},
    scheduleVoiceHealthProbeFn: () => {},
    scheduleVoiceLiveReconfigureFlowFn: () => {},
    clearTimeoutFn: () => {},
    setTimeoutFn: () => {},
    cancelPerfTraceFn: () => {},
    addPerfPhaseFn: () => {},
    reconfigureLiveCaptureFn: () => {},
    startPerfTraceFn: () => {},
    endPerfTraceFn: () => {},
    switchLiveCaptureModeInPlaceFn: () => {},
    applyNoiseSuppressionRoutingFn: () => {},
    applyVoiceModeDependenciesFn: () => {},
    persistVoiceProcessingModeFn: () => {},
    persistNoiseSuppressionEnabledFn: () => {},
    isUltraLowLatencyModeFn: () => false,
    deps,
  });

  assert.equal(uiDeps.deps, deps);
  assert.equal(typeof uiDeps.reconfigureLiveCaptureFn, 'function');
});

test('voice hook controller runtime deps preserve the runtime bindings bag', () => {
  const screenShareProfiles = [{ key: 'balanced' }];
  const runtimeDeps = buildUseVoiceHookRuntimeBindingsRuntimeDeps({
    socket: { on() {} },
    currentUserId: 'user-1',
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    buildVoiceTrustErrorFn: () => new Error('trust'),
    setJoinErrorFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    syncVoiceParticipantsFn: () => {},
    syncVoiceE2EStateFn: () => {},
    handleUnexpectedVoiceSessionEndFn: () => {},
    cleanupRemoteProducerFn: () => {},
    consumeProducerFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => false,
    setPeersFn: () => {},
    resetVoiceSessionFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    prefersAppleSystemVoiceIsolationFn: () => false,
    electronAPI: { getPlatform() { return 'darwin'; } },
    summarizeProducerStatsFn: () => ({}),
    summarizeConsumerStatsFn: () => ({}),
    isVoiceDiagnosticsEnabledFn: () => true,
    getBitrateBpsFn: () => 123,
    setScreenShareDiagnosticsFn: () => {},
    maybeAdaptScreenShareProfileFn: () => {},
    summarizeTrackSnapshotFn: () => ({}),
    summarizeScreenShareProfileFn: () => ({}),
    summarizeScreenShareHardwareFn: () => ({}),
    screenShareProfiles,
    roundRateFn: () => 1,
    clearTimeoutFn: () => {},
  });

  assert.equal(runtimeDeps.currentUserId, 'user-1');
  assert.equal(runtimeDeps.screenShareProfiles, screenShareProfiles);
  assert.equal(runtimeDeps.getBitrateBpsFn(), 123);
});

test('voice hook controller runtime deps export the dedicated runtime dep modules', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const securitySource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const captureSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const mediaTransportSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeBindingsRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookSecurityRuntimeDeps/);
  assert.match(source, /voiceHookCaptureRuntimeDeps/);
  assert.match(source, /voiceHookMediaTransportRuntimeDeps/);
  assert.match(source, /voiceHookSessionRuntimeDeps/);
  assert.match(source, /voiceHookUiRuntimeDeps/);
  assert.match(source, /voiceHookRuntimeBindingsRuntimeDeps/);
  assert.match(securitySource, /export function buildUseVoiceHookSecurityRuntimeDeps/);
  assert.match(captureSource, /export function buildUseVoiceHookCaptureRuntimeDeps/);
  assert.match(mediaTransportSource, /export function buildUseVoiceHookMediaTransportRuntimeDeps/);
  assert.match(sessionSource, /export function buildUseVoiceHookSessionRuntimeDeps/);
  assert.match(uiSource, /export function buildUseVoiceHookUiRuntimeDeps/);
  assert.match(runtimeEffectsSource, /export function buildUseVoiceHookRuntimeBindingsRuntimeDeps/);
});
