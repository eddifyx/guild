import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceHookCaptureRuntime,
  buildUseVoiceHookMediaTransportRuntime,
  buildUseVoiceHookRuntimeBindingsRuntime,
  buildUseVoiceHookScreenShareRuntime,
  buildUseVoiceHookSecurityRuntime,
  buildUseVoiceHookSessionRuntime,
  buildUseVoiceHookUiRuntime,
} from '../../../client/src/features/voice/voiceHookControllerRuntimeBindings.mjs';

test('voice hook controller runtime bindings keep screen share, security, capture, and media contracts stable', () => {
  const ensureSecureMediaReadyFn = () => {};
  const ensureVoiceKeyForParticipantsFn = () => {};
  const getOrCreateScreenSendTransportFn = () => {};
  const cleanupScreenShareSessionFn = () => {};
  assert.deepEqual(buildUseVoiceHookScreenShareRuntime({
    ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn,
    cleanupScreenShareSessionFn,
  }), {
    ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn,
    cleanupScreenShareSessionFn,
  });

  const clearVoiceKeyFn = () => {};
  const updateVoiceDiagnosticsFn = () => {};
  assert.deepEqual(buildUseVoiceHookSecurityRuntime({
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  }), {
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  });

  const applyNoiseSuppressionRoutingFn = () => {};
  const applySenderPreferencesFn = () => {};
  const getVoiceAudioBypassModeFn = () => {};
  assert.deepEqual(buildUseVoiceHookCaptureRuntime({
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
  assert.deepEqual(buildUseVoiceHookMediaTransportRuntime({
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

test('voice hook controller runtime bindings preserve the session and ui dependency bags', () => {
  const deps = ['dep-a', 'dep-b'];
  const constants = { voiceSessionErrorTimeoutMs: 8000 };
  const emitAsyncFn = () => {};
  const sessionRuntime = buildUseVoiceHookSessionRuntime({
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
    getPlatformFn: () => {},
    prefetchDesktopSourcesFn: () => {},
    applyLiveCaptureToProducerFn: () => {},
    setMutedFn: () => {},
    scheduleVoiceHealthProbeFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => {},
    normalizeVoiceErrorMessageFn: () => {},
    scheduleClearJoinErrorFn: () => {},
    logErrorFn: () => {},
    constants,
    deps,
  });
  assert.equal(sessionRuntime.emitAsyncFn, emitAsyncFn);
  assert.equal(sessionRuntime.constants, constants);
  assert.equal(sessionRuntime.deps, deps);

  const uiDeps = ['ui-a'];
  const uiRuntime = buildUseVoiceHookUiRuntime({
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
    isUltraLowLatencyModeFn: () => {},
    deps: uiDeps,
  });
  assert.equal(uiRuntime.deps, uiDeps);
});

test('voice hook controller runtime bindings preserve the runtime-effects diagnostics contract', () => {
  const screenShareProfiles = [{ key: 'balanced' }];
  const runtime = buildUseVoiceHookRuntimeBindingsRuntime({
    socket: { on() {} },
    currentUserId: 'user-1',
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => {},
    buildVoiceTrustErrorFn: () => {},
    setJoinErrorFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    syncVoiceParticipantsFn: () => {},
    syncVoiceE2EStateFn: () => {},
    handleUnexpectedVoiceSessionEndFn: () => {},
    cleanupRemoteProducerFn: () => {},
    consumeProducerFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => {},
    setPeersFn: () => {},
    resetVoiceSessionFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    prefersAppleSystemVoiceIsolationFn: () => {},
    electronAPI: { getPlatform() { return 'darwin'; } },
    summarizeProducerStatsFn: () => {},
    summarizeConsumerStatsFn: () => {},
    isVoiceDiagnosticsEnabledFn: () => true,
    getBitrateBpsFn: () => 123,
    setScreenShareDiagnosticsFn: () => {},
    maybeAdaptScreenShareProfileFn: () => {},
    summarizeTrackSnapshotFn: () => {},
    summarizeScreenShareProfileFn: () => {},
    summarizeScreenShareHardwareFn: () => {},
    screenShareProfiles,
    roundRateFn: () => 1,
    clearTimeoutFn: () => {},
  });
  assert.equal(runtime.currentUserId, 'user-1');
  assert.equal(runtime.screenShareProfiles, screenShareProfiles);
  assert.equal(runtime.getBitrateBpsFn(), 123);
});

test('voice hook controller runtime bindings export the dedicated runtime binding modules', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const screenShareSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const securitySource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const captureSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const mediaTransportSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeBindingsRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookScreenShareRuntimeBindings/);
  assert.match(source, /voiceHookSecurityRuntimeBindings/);
  assert.match(source, /voiceHookCaptureRuntimeBindings/);
  assert.match(source, /voiceHookMediaTransportRuntimeBindings/);
  assert.match(source, /voiceHookSessionRuntimeBindings/);
  assert.match(source, /voiceHookUiRuntimeBindings/);
  assert.match(source, /voiceHookRuntimeBindingsRuntimeBindings/);
  assert.match(screenShareSource, /export function buildUseVoiceHookScreenShareRuntime/);
  assert.match(securitySource, /export function buildUseVoiceHookSecurityRuntime/);
  assert.match(captureSource, /export function buildUseVoiceHookCaptureRuntime/);
  assert.match(mediaTransportSource, /export function buildUseVoiceHookMediaTransportRuntime/);
  assert.match(sessionSource, /export function buildUseVoiceHookSessionRuntime/);
  assert.match(uiSource, /export function buildUseVoiceHookUiRuntime/);
  assert.match(runtimeEffectsSource, /export function buildUseVoiceHookRuntimeBindingsRuntime/);
});
